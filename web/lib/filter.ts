// The filter engine (spec §4.1). Pure and synchronous: the whole dataset is already in
// memory, so every control is two integer ops per row and needs no network round-trip.

import { DOMAINS, type PubRow, STUDY_IDS } from './data';

export type MatchType = 'any' | 'all';

export interface FilterState {
  /**
   * Bitmask of selected studies over STUDY_IDS. Unlike `domains`, 0 does NOT mean
   * "no filter" — it means nothing can match, exactly like clearing both member boxes.
   * The default is every study selected (spec §4.1).
   */
  studies: number;
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

/** Every study selected — the default, and what "Clear All Filters" restores. */
export const ALL_STUDIES: number = (1 << STUDY_IDS.length) - 1;

export function studyMaskOf(studies: readonly string[]): number {
  let mask = 0;
  for (const s of studies) {
    const bit = STUDY_IDS.indexOf(s as (typeof STUDY_IDS)[number]);
    if (bit >= 0) mask |= 1 << bit;
  }
  return mask;
}

export function studyNamesOf(mask: number): string[] {
  return STUDY_IDS.filter((_, bit) => (mask >> bit) & 1);
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
    studies: ALL_STUDIES,
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
    filter.studies === d.studies &&
    filter.domains === d.domains &&
    filter.matchType === d.matchType &&
    filter.members.yes === d.members.yes &&
    filter.members.no === d.members.no &&
    filter.yearMin === d.yearMin &&
    filter.yearMax === d.yearMax
  );
}

export function filterRows(rows: readonly PubRow[], filter: FilterState): PubRow[] {
  const { studies, domains, matchType, members, yearMin, yearMax } = filter;
  const studyBit = new Map(STUDY_IDS.map((id, bit) => [id, 1 << bit]));
  return rows.filter((row) => {
    if (((studyBit.get(row.study) ?? 0) & studies) === 0) return false;
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
