// The published-data format (spec §3.2) and the encode/decode pair that defines it.
// Imported by BOTH scripts/prep.ts (writer) and the browser (reader), so the shape can only
// ever be described once. Keep this module pure — no DOM, no node built-ins.

/**
 * The NBDC studies, in the order rows are concatenated (spec §1.1, §3.2). Adding a study is
 * an entry here plus a data/portfolio_<id>.csv — no schema change, because no column name is
 * study-specific. Declaration order is part of the contract: row index drives shard
 * assignment, so reordering would reshuffle every abstract shard and void every cached copy.
 */
export const STUDIES = [
  { id: 'abcd', label: 'ABCD', name: 'Adolescent Brain Cognitive Development (ABCD) Study' },
  { id: 'hbcd', label: 'HBCD', name: 'HEALthy Brain and Child Development (HBCD) Study' },
] as const;

export type StudyId = (typeof STUDIES)[number]['id'];

export const STUDY_IDS: readonly StudyId[] = STUDIES.map((s) => s.id);

/** Display label for a study id; falls back to the id so unknown data never renders blank. */
export function studyLabel(id: string): string {
  return STUDIES.find((s) => s.id === id)?.label ?? id;
}

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
  'Study.member',
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
export const MEMBER_COLUMN = 'Study.member';
export const URL_COLUMN = 'URL';

/**
 * Derived, never sourced: a row's study comes from the file it was read from, so an operator
 * cannot mislabel it. Prepended to every export (spec §4.4) — 47 columns, not 46.
 */
export const STUDY_COLUMN = 'Study';
export const EXPORT_COLUMNS: readonly string[] = [STUDY_COLUMN, ...COLUMNS];

/** Columns that get their own typed array in the index. */
const DEDICATED_COLUMNS: readonly string[] = [
  'Pub.Year',
  'Title',
  'Authors',
  'Journal.Name',
  'URL',
  'Study.member',
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
  /** Index into PubIndex.studies. */
  study: number[];
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
  /** Every declared study id, in STUDIES order — including any with zero rows. */
  studies: string[];
  /** Study ids that ship a documentation PDF; the rest simply get no download link. */
  documentation: string[];
  domains: string[];
  journals: string[];
  shardSize: number;
  cols: IndexCols;
}

/** The decoded shape the UI works with. Export-only columns stay in the index. */
export interface PubRow {
  i: number;
  study: StudyId;
  /** `<study>:<URL>` — the selection and export identity (spec §3.5). */
  key: string;
  year: number;
  title: string;
  authors: string;
  journal: string;
  url: string;
  member: 'yes' | 'no';
  mask: number;
}

/** The selection and export identity for a row (spec §3.5). */
export function rowKey(study: string, url: string): string {
  return `${study}:${url}`;
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

/** One study's parsed records. Groups are encoded in the order given (spec §3.2). */
export interface StudyGroup {
  study: StudyId;
  records: Record<string, string>[];
}

export function encodeIndex(
  groups: readonly StudyGroup[],
  lastUpdated: string,
  documentation: readonly string[] = [],
): PubIndex {
  const journals: string[] = [];
  const journalIds = new Map<string, number>();

  const cols: IndexCols = {
    study: [],
    year: [],
    title: [],
    authors: [],
    journal: [],
    url: [],
    member: [],
    domainMask: [],
    extra: {},
  };

  // Flattened once, in group order, so row index — and therefore shard assignment — is a
  // pure function of the input order.
  const records = groups.flatMap((g) => g.records);

  for (const group of groups) {
    const studyId = STUDY_IDS.indexOf(group.study);
    for (const r of group.records) {
      const journal = r['Journal.Name'] ?? '';
      let id = journalIds.get(journal);
      if (id === undefined) {
        id = journals.length;
        journals.push(journal);
        journalIds.set(journal, id);
      }
      cols.study.push(studyId);
      cols.year.push(Number(r[YEAR_COLUMN]));
      cols.title.push(r.Title ?? '');
      cols.authors.push(r.Authors ?? '');
      cols.journal.push(id);
      cols.url.push(r[URL_COLUMN] ?? '');
      cols.member.push(r[MEMBER_COLUMN] === 'yes' ? 1 : 0);
      cols.domainMask.push(maskFor(r));
    }
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
    // Every declared study, not just the ones with rows — an empty study still needs a
    // filter checkbox and a banner (spec §1.1).
    studies: [...STUDY_IDS],
    documentation: [...documentation],
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
    const study = (index.studies[cols.study[i] as number] ?? STUDY_IDS[0]) as StudyId;
    const url = cols.url[i] as string;
    rows[i] = {
      i,
      study,
      key: rowKey(study, url),
      year: cols.year[i] as number,
      title: cols.title[i] as string,
      authors: cols.authors[i] as string,
      journal: journals[cols.journal[i] as number] as string,
      url,
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
 * Rebuilds full 47-column rows for export: the derived `Study` label, then the 46 source
 * columns in source order (spec §4.4).
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
    return EXPORT_COLUMNS.map((c) => {
      switch (c) {
        case STUDY_COLUMN:
          return studyLabel(index.studies[cols.study[i] as number] ?? '');
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
        case MEMBER_COLUMN:
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
