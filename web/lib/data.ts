// The published-data format (spec §3.2) and the encode/decode pair that defines it.
// Imported by BOTH scripts/prep.ts (writer) and the browser (reader), so the shape can only
// ever be described once. Keep this module pure — no DOM, no node built-ins.

/** The 10 research domains, in display order (matches the Shiny app's sorted order). */
export const DOMAINS = [
  'COVID',
  'Friends, Family, & Community',
  'Genetics',
  'Linked External Data',
  'Mental Health',
  'MRI',
  'NeuroCognition',
  'Novel Technologies',
  'Physical Health',
  'Substance Use',
] as const;

/** The 46 source columns, in source order. Exports must reproduce this exactly. */
export const COLUMNS = [
  'Pub.Year',
  'Pub.Date',
  'Title',
  'Authors',
  'Abstract',
  'Journal.Name',
  'URL',
  'DOI',
  'PMID',
  'Journal.Citation.Rate',
  'Article.Citation.Rate',
  'RCR',
  'RCR.Is.Provisional',
  'Total.Citations',
  'Cited.By.Clinical.Article',
  'Clinical.Impact',
  'Altmetric.Attention.Score',
  'News.mentions',
  'Blog.mentions',
  'Policy.mentions',
  'Patent.mentions',
  'X.mentions',
  'Peer.review.mentions',
  'Facebook.mentions',
  'Wikipedia.mentions',
  'Google..mentions',
  'Reddit.mentions',
  'F1000.mentions',
  'Q.A.mentions',
  'Video.mentions',
  'Clinical.guidelines.mentions',
  'Bluesky.mentions',
  'Podcast.mentions',
  'ABCD.member',
  'Domains',
  'COVID',
  'Friends, Family, & Community',
  'Genetics',
  'Linked External Data',
  'Mental Health',
  'MRI',
  'NeuroCognition',
  'Novel Technologies',
  'Physical Health',
  'Substance Use',
  '# domains',
] as const;

export const ABSTRACT_COLUMN = 'Abstract';
export const YEAR_COLUMN = 'Pub.Year';
export const MEMBER_COLUMN = 'ABCD.member';
export const URL_COLUMN = 'URL';

/** Columns that get their own typed array in the index. */
const DEDICATED_COLUMNS: readonly string[] = [
  'Pub.Year',
  'Title',
  'Authors',
  'Journal.Name',
  'URL',
  'ABCD.member',
];

const DOMAIN_SET: ReadonlySet<string> = new Set(DOMAINS);

/**
 * Everything else, kept verbatim so exports reproduce the source. Abstracts live in shards
 * and the 10 domain flags are derived from the bitmask, so neither appears here.
 */
export const EXTRA_COLUMNS: readonly string[] = COLUMNS.filter(
  (c) => c !== ABSTRACT_COLUMN && !DEDICATED_COLUMNS.includes(c) && !DOMAIN_SET.has(c),
);

/** Abstracts are split into this many shards, fetched only when a user needs one. */
export const SHARD_COUNT = 32;

/** A column value packed as a number when that survives a String(Number(v)) round-trip. */
export type Packed = string | number;

export interface IndexCols {
  year: number[];
  title: string[];
  authors: string[];
  /** Index into PubIndex.journals. */
  journal: number[];
  url: string[];
  /** 1 = "yes", 0 = "no". */
  member: number[];
  /** Bit i is set when DOMAINS[i] applies to the row. */
  domainMask: number[];
  extra: Record<string, Packed[]>;
}

export interface PubIndex {
  lastUpdated: string;
  rowCount: number;
  yearMin: number;
  yearMax: number;
  columns: string[];
  domains: string[];
  journals: string[];
  shardSize: number;
  cols: IndexCols;
}

/** The decoded shape the UI works with. Export-only columns stay in the index. */
export interface PubRow {
  i: number;
  year: number;
  title: string;
  authors: string;
  journal: string;
  url: string;
  member: 'yes' | 'no';
  mask: number;
}

export function shardSizeFor(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / SHARD_COUNT));
}

export function shardIndexFor(
  rowIndex: number,
  shardSize: number,
): { shard: number; offset: number } {
  return { shard: Math.floor(rowIndex / shardSize), offset: rowIndex % shardSize };
}

/** Zero-padded shard filename, e.g. 7 → "07.json". */
export function shardFileName(shard: number): string {
  return `${String(shard).padStart(2, '0')}.json`;
}

/**
 * Stores a column as numbers when every value survives Number→String unchanged; otherwise
 * keeps the original strings. Guarantees exports reproduce the source text byte-for-byte
 * ("1.0" stays a string, because Number("1.0") stringifies back to "1").
 */
function packColumn(values: string[]): Packed[] {
  const packable = values.every((v) => {
    if (v === '') return true;
    const n = Number(v);
    return Number.isFinite(n) && String(n) === v;
  });
  return packable ? values.map((v) => (v === '' ? '' : Number(v))) : values;
}

export function maskFor(record: Record<string, string>): number {
  let mask = 0;
  for (const [bit, domain] of DOMAINS.entries()) {
    if (record[domain] === '1') mask |= 1 << bit;
  }
  return mask;
}

export function encodeIndex(records: Record<string, string>[], lastUpdated: string): PubIndex {
  const journals: string[] = [];
  const journalIds = new Map<string, number>();

  const cols: IndexCols = {
    year: [],
    title: [],
    authors: [],
    journal: [],
    url: [],
    member: [],
    domainMask: [],
    extra: {},
  };

  for (const r of records) {
    const journal = r['Journal.Name'] ?? '';
    let id = journalIds.get(journal);
    if (id === undefined) {
      id = journals.length;
      journals.push(journal);
      journalIds.set(journal, id);
    }
    cols.year.push(Number(r[YEAR_COLUMN]));
    cols.title.push(r.Title ?? '');
    cols.authors.push(r.Authors ?? '');
    cols.journal.push(id);
    cols.url.push(r[URL_COLUMN] ?? '');
    cols.member.push(r[MEMBER_COLUMN] === 'yes' ? 1 : 0);
    cols.domainMask.push(maskFor(r));
  }

  for (const c of EXTRA_COLUMNS) {
    cols.extra[c] = packColumn(records.map((r) => r[c] ?? ''));
  }

  return {
    lastUpdated,
    rowCount: records.length,
    yearMin: Math.min(...cols.year),
    yearMax: Math.max(...cols.year),
    columns: [...COLUMNS],
    domains: [...DOMAINS],
    journals,
    shardSize: shardSizeFor(records.length),
    cols,
  };
}

export function decodeRows(index: PubIndex): PubRow[] {
  const { cols, journals } = index;
  const rows: PubRow[] = new Array(index.rowCount);
  for (let i = 0; i < index.rowCount; i++) {
    rows[i] = {
      i,
      year: cols.year[i] as number,
      title: cols.title[i] as string,
      authors: cols.authors[i] as string,
      journal: journals[cols.journal[i] as number] as string,
      url: cols.url[i] as string,
      member: cols.member[i] === 1 ? 'yes' : 'no',
      mask: cols.domainMask[i] as number,
    };
  }
  return rows;
}

/** The `;`-joined domain names for a row, rebuilt from the bitmask. */
export function domainsFor(mask: number): string[] {
  return DOMAINS.filter((_, bit) => (mask >> bit) & 1);
}

/**
 * Rebuilds full 46-column rows for export, in COLUMNS order.
 * `abstracts` is indexed by absolute row index; missing entries export as empty.
 */
export function buildExportRows(
  index: PubIndex,
  rowIndexes: readonly number[],
  abstracts: readonly (string | undefined)[],
): string[][] {
  const { cols, journals } = index;
  return rowIndexes.map((i) => {
    const mask = cols.domainMask[i] as number;
    return COLUMNS.map((c) => {
      switch (c) {
        case 'Pub.Year':
          return String(cols.year[i]);
        case 'Title':
          return cols.title[i] as string;
        case 'Authors':
          return cols.authors[i] as string;
        case 'Abstract':
          return abstracts[i] ?? '';
        case 'Journal.Name':
          return journals[cols.journal[i] as number] as string;
        case 'URL':
          return cols.url[i] as string;
        case 'ABCD.member':
          return cols.member[i] === 1 ? 'yes' : 'no';
        default:
          if (DOMAIN_SET.has(c)) {
            return (mask >> DOMAINS.indexOf(c as (typeof DOMAINS)[number])) & 1 ? '1' : '0';
          }
          return String(cols.extra[c]?.[i] ?? '');
      }
    });
  });
}
