// Data-prep pipeline (spec §3). Turns the committed per-study CSVs into the published
// artifacts under web/public/, and fails the build rather than publish something malformed.
//
//   data/portfolio_<study>.csv → web/public/data/index.json          (45 non-abstract columns)
//                              → web/public/data/studies.json        (per-study row counts)
//                              → web/public/data/abstracts/NN.json   (32 lazy shards)
//                              → web/public/downloads/nbdc-pubs_unfiltered_<lastUpdated>.csv
//   data/docs/<study>_data-document.pdf → web/public/downloads/
//
// Studies are read in STUDIES declaration order; one with zero rows is normal (spec §1.1).
// Run with `npm run prep`. No R involved — CSV is the contract.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { toCsv } from '../web/lib/csv';
import {
  buildExportRows,
  EXPORT_COLUMNS,
  encodeIndex,
  type PubIndex,
  SHARD_COUNT,
  STUDIES,
  type StudyGroup,
  type StudyId,
  shardFileName,
  shardSizeFor,
} from '../web/lib/data';
import { parseCsv } from './csv';
import { validateRecords } from './validate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_META = join(ROOT, 'data', 'portfolio.meta.json');
const OUT_DATA = join(ROOT, 'web', 'public', 'data');
const OUT_DOWNLOADS = join(ROOT, 'web', 'public', 'downloads');

const sourceCsv = (study: StudyId) => join(ROOT, 'data', `portfolio_${study}.csv`);
const sourceDoc = (study: StudyId) => join(ROOT, 'data', 'docs', `${study}_data-document.pdf`);
const publishedDoc = (study: StudyId) => `${study}_data-document.pdf`;

/** Gzipped ceilings from spec §3.3. Exceeding either fails the build. */
export const SIZE_BUDGET = { indexBytes: 350 * 1024, shardBytes: 60 * 1024 };

export class SizeBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SizeBudgetError';
  }
}

export interface Artifacts {
  index: PubIndex;
  /** shards[s][offset] — the abstract for row s * shardSize + offset. */
  shards: string[][];
  unfilteredCsv: string;
}

export function buildArtifacts(groups: readonly StudyGroup[], lastUpdated: string): Artifacts {
  const records = groups.flatMap((g) => g.records);
  const index = encodeIndex(groups, lastUpdated);
  const shardSize = shardSizeFor(records.length);

  const shards: string[][] = Array.from({ length: SHARD_COUNT }, () => []);
  for (const [i, record] of records.entries()) {
    (shards[Math.floor(i / shardSize)] as string[]).push(record.Abstract ?? '');
  }

  const abstracts = records.map((r) => r.Abstract ?? '');
  const allRows = records.map((_, i) => i);
  const unfilteredCsv = toCsv(EXPORT_COLUMNS, buildExportRows(index, allRows, abstracts));

  return { index, shards, unfilteredCsv };
}

export interface SizeReport {
  indexGzip: number;
  shardGzipMax: number;
  unfilteredGzip: number;
}

export function assertSizeBudget(
  artifacts: Artifacts,
  budget: { indexBytes: number; shardBytes: number } = SIZE_BUDGET,
): SizeReport {
  const gz = (s: string) => gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).byteLength;

  const indexGzip = gz(JSON.stringify(artifacts.index));
  const shardGzips = artifacts.shards.map((s) => gz(JSON.stringify(s)));
  const shardGzipMax = Math.max(...shardGzips);

  if (indexGzip > budget.indexBytes) {
    throw new SizeBudgetError(
      `index.json is ${kb(indexGzip)} gzipped, over the ${kb(budget.indexBytes)} budget. ` +
        'Move export-only columns into the lazy shards, or raise the budget in spec §3.3 deliberately.',
    );
  }
  const over = shardGzips.findIndex((b) => b > budget.shardBytes);
  if (over !== -1) {
    throw new SizeBudgetError(
      `abstract shard ${shardFileName(over)} is ${kb(shardGzips[over] as number)} gzipped, ` +
        `over the ${kb(budget.shardBytes)} budget. Raise SHARD_COUNT.`,
    );
  }

  return { indexGzip, shardGzipMax, unfilteredGzip: gz(artifacts.unfilteredCsv) };
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** One entry per declared study, as published in studies.json (spec §3.2). */
export interface StudySummary {
  id: StudyId;
  label: string;
  name: string;
  rowCount: number;
  lastUpdated: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Per-study snapshot dates. `null` means the study has not published data yet, which is a
 * supported state — only a malformed value is an error.
 */
export function readStudyDates(): Record<StudyId, string | null> {
  const raw = JSON.parse(readFileSync(SOURCE_META, 'utf8')) as {
    studies?: Record<string, { lastUpdated?: unknown }>;
  };
  const studies = raw.studies;
  if (typeof studies !== 'object' || studies === null) {
    throw new Error('data/portfolio.meta.json: expected a "studies" object (spec §3.1).');
  }

  const dates = {} as Record<StudyId, string | null>;
  for (const study of STUDIES) {
    const entry = studies[study.id];
    if (entry === undefined) {
      throw new Error(`data/portfolio.meta.json: missing an entry for study "${study.id}".`);
    }
    const value = entry.lastUpdated;
    if (value !== null && (typeof value !== 'string' || !DATE_RE.test(value))) {
      throw new Error(
        `data/portfolio.meta.json: "${study.id}".lastUpdated must be YYYY-MM-DD or null, ` +
          `got ${JSON.stringify(value)}.`,
      );
    }
    dates[study.id] = value;
  }
  return dates;
}

/**
 * A publication that uses two studies' data legitimately appears in both files, so this is a
 * warning rather than a failure — `<study>:<URL>` keeps both rows addressable (spec §3.5).
 */
export function warnCrossStudyUrls(groups: readonly StudyGroup[]): string[] {
  const owners = new Map<string, StudyId[]>();
  for (const group of groups) {
    for (const record of group.records) {
      const url = record.URL ?? '';
      const seen = owners.get(url);
      if (seen) seen.push(group.study);
      else owners.set(url, [group.study]);
    }
  }
  return [...owners.entries()]
    .filter(([, studies]) => studies.length > 1)
    .map(([url, studies]) => `${url} appears in ${studies.join(' and ')}`);
}

function main(): void {
  if (!existsSync(SOURCE_META)) throw new Error(`missing required input: ${SOURCE_META}`);
  const dates = readStudyDates();

  // Read every study in declaration order — that order fixes row indexes and therefore
  // shard assignment (spec §3.2).
  const groups: StudyGroup[] = [];
  for (const study of STUDIES) {
    const path = sourceCsv(study.id);
    if (!existsSync(path)) throw new Error(`missing required input: ${path}`);
    const { header, rows } = parseCsv(readFileSync(path, 'utf8'));
    groups.push({ study: study.id, records: validateRecords(study.id, header, rows) });
  }

  const total = groups.reduce((n, g) => n + g.records.length, 0);
  if (total === 0) {
    throw new Error(
      'every study CSV is empty — at least one study must have rows to publish (spec §3.1).',
    );
  }

  // The site-wide date is the most recent any study has published.
  const published = Object.values(dates).filter((d): d is string => d !== null);
  const lastUpdated = published.length > 0 ? (published.sort().at(-1) as string) : '';
  if (!lastUpdated) {
    throw new Error('no study has a lastUpdated date, but rows were published (spec §3.1).');
  }

  const artifacts = buildArtifacts(groups, lastUpdated);
  const sizes = assertSizeBudget(artifacts);

  const summaries: StudySummary[] = STUDIES.map((study, i) => ({
    id: study.id,
    label: study.label,
    name: study.name,
    rowCount: groups[i]?.records.length ?? 0,
    lastUpdated: dates[study.id],
  }));

  // Rewrite from scratch so a removed row can never linger in a stale shard.
  rmSync(OUT_DATA, { recursive: true, force: true });
  rmSync(OUT_DOWNLOADS, { recursive: true, force: true });
  mkdirSync(join(OUT_DATA, 'abstracts'), { recursive: true });
  mkdirSync(OUT_DOWNLOADS, { recursive: true });

  writeFileSync(join(OUT_DATA, 'index.json'), JSON.stringify(artifacts.index));
  writeFileSync(join(OUT_DATA, 'studies.json'), JSON.stringify(summaries));
  for (const [s, shard] of artifacts.shards.entries()) {
    writeFileSync(join(OUT_DATA, 'abstracts', shardFileName(s)), JSON.stringify(shard));
  }
  writeFileSync(
    join(OUT_DOWNLOADS, `nbdc-pubs_unfiltered_${lastUpdated}.csv`),
    artifacts.unfilteredCsv,
  );

  // A study without a documentation PDF simply gets no download link.
  const docs: StudyId[] = [];
  for (const study of STUDIES) {
    if (!existsSync(sourceDoc(study.id))) continue;
    copyFileSync(sourceDoc(study.id), join(OUT_DOWNLOADS, publishedDoc(study.id)));
    docs.push(study.id);
  }

  console.log(`prep: ${total} records, last updated ${lastUpdated}`);
  for (const summary of summaries) {
    const stamp = summary.lastUpdated ?? 'no data yet';
    console.log(
      `  ${summary.label.padEnd(6)} ${String(summary.rowCount).padStart(6)} rows  (${stamp})`,
    );
  }
  console.log(
    `  index.json        ${kb(sizes.indexGzip)} gzipped (budget ${kb(SIZE_BUDGET.indexBytes)})`,
  );
  console.log(
    `  largest shard     ${kb(sizes.shardGzipMax)} gzipped (budget ${kb(SIZE_BUDGET.shardBytes)})`,
  );
  console.log(`  unfiltered CSV    ${kb(sizes.unfilteredGzip)} gzipped`);
  console.log(`  documentation     ${docs.length > 0 ? docs.join(', ') : 'none'}`);

  for (const warning of warnCrossStudyUrls(groups)) {
    console.warn(`  warning: ${warning}`);
  }
}

// Only run the pipeline when invoked as a script, so tests can import the pure parts.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(`\nprep failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
