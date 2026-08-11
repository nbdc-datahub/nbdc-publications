// The filter engine (spec §4.1). Pure and synchronous: the whole dataset is already in
// memory, so every control is two integer ops per row and needs no network round-trip.

import { DOMAINS, type PubRow } from './data';

export type MatchType = 'any' | 'all';

export interface FilterState {
  /** Bitmask of selected domains; 0 = no domain filter. */
  domains: number;
  matchType: MatchType;
  members: { yes: boolean; no: boolean };
  yearMin: number;
  yearMax: number;
}

export interface YearBounds {
  yearMin: number;
  yearMax: number;
}

export function maskOf(domains: readonly string[]): number {
  let mask = 0;
  for (const d of domains) {
    const bit = DOMAINS.indexOf(d as (typeof DOMAINS)[number]);
    if (bit >= 0) mask |= 1 << bit;
  }
  return mask;
}

export function namesOf(mask: number): string[] {
  return DOMAINS.filter((_, bit) => (mask >> bit) & 1);
}

export function defaultFilter(bounds: YearBounds): FilterState {
  return {
    domains: 0,
    matchType: 'any',
    members: { yes: true, no: true },
    yearMin: bounds.yearMin,
    yearMax: bounds.yearMax,
  };
}

export function isDefaultFilter(filter: FilterState, bounds: YearBounds): boolean {
  const d = defaultFilter(bounds);
  return (
    filter.domains === d.domains &&
    filter.matchType === d.matchType &&
    filter.members.yes === d.members.yes &&
    filter.members.no === d.members.no &&
    filter.yearMin === d.yearMin &&
    filter.yearMax === d.yearMax
  );
}

export function filterRows(rows: readonly PubRow[], filter: FilterState): PubRow[] {
  const { domains, matchType, members, yearMin, yearMax } = filter;
  return rows.filter((row) => {
    if (row.year < yearMin || row.year > yearMax) return false;
    if (!(row.member === 'yes' ? members.yes : members.no)) return false;
    if (domains !== 0) {
      const hit = row.mask & domains;
      if (matchType === 'all' ? hit !== domains : hit === 0) return false;
    }
    return true;
  });
}

/**
 * The table's free-text search. Kept here rather than inside the table component so the
 * "Download All Search Results" export and the table always agree on one row set.
 * All terms must match (AND), each against title, authors, journal or year.
 */
export function searchRows(rows: readonly PubRow[], query: string): PubRow[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = `${row.title} ${row.authors} ${row.journal} ${row.year}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Per-domain counts over the filtered set. Domains are not mutually exclusive. */
export function domainCounts(rows: readonly PubRow[]): number[] {
  const counts = new Array(DOMAINS.length).fill(0) as number[];
  for (const row of rows) {
    for (let bit = 0; bit < DOMAINS.length; bit++) {
      if ((row.mask >> bit) & 1) counts[bit] = (counts[bit] as number) + 1;
    }
  }
  return counts;
}

export interface YearCount {
  year: number;
  yes: number;
  no: number;
  total: number;
}

/** Per-year counts split by ABCD membership, ascending by year. */
export function yearCounts(rows: readonly PubRow[]): YearCount[] {
  const byYear = new Map<number, YearCount>();
  for (const row of rows) {
    let entry = byYear.get(row.year);
    if (!entry) {
      entry = { year: row.year, yes: 0, no: 0, total: 0 };
      byYear.set(row.year, entry);
    }
    entry[row.member] += 1;
    entry.total += 1;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
