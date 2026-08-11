// Data-prep pipeline (spec §3). Turns the committed data/portfolio.csv into the published
// artifacts under web/public/, and fails the build rather than publish something malformed.
//
//   data/portfolio.csv        → web/public/data/index.json          (45 non-abstract columns)
//                             → web/public/data/abstracts/NN.json   (32 lazy shards)
//                             → web/public/downloads/abcd-pubs_unfiltered_<lastUpdated>.csv
//   data/abcd-pubs_data-document.pdf → web/public/downloads/
//
// Run with `npm run prep`. No R involved — CSV is the contract.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { toCsv } from '../web/lib/csv';
import {
  buildExportRows,
  COLUMNS,
  encodeIndex,
  type PubIndex,
  SHARD_COUNT,
  shardFileName,
  shardSizeFor,
} from '../web/lib/data';
import { parseCsv } from './csv';
import { validateRecords } from './validate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_CSV = join(ROOT, 'data', 'portfolio.csv');
const SOURCE_META = join(ROOT, 'data', 'portfolio.meta.json');
const SOURCE_PDF = join(ROOT, 'data', 'abcd-pubs_data-document.pdf');
const OUT_DATA = join(ROOT, 'web', 'public', 'data');
const OUT_DOWNLOADS = join(ROOT, 'web', 'public', 'downloads');

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

export function buildArtifacts(records: Record<string, string>[], lastUpdated: string): Artifacts {
  const index = encodeIndex(records, lastUpdated);
  const shardSize = shardSizeFor(records.length);

  const shards: string[][] = Array.from({ length: SHARD_COUNT }, () => []);
  for (const [i, record] of records.entries()) {
    (shards[Math.floor(i / shardSize)] as string[]).push(record.Abstract ?? '');
  }

  const abstracts = records.map((r) => r.Abstract ?? '');
  const allRows = records.map((_, i) => i);
  const unfilteredCsv = toCsv(COLUMNS, buildExportRows(index, allRows, abstracts));

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

function readLastUpdated(): string {
  const raw = JSON.parse(readFileSync(SOURCE_META, 'utf8')) as { lastUpdated?: unknown };
  const value = raw.lastUpdated;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `data/portfolio.meta.json: "lastUpdated" must be a YYYY-MM-DD string, got ${JSON.stringify(value)}.`,
    );
  }
  return value;
}

function main(): void {
  for (const path of [SOURCE_CSV, SOURCE_META, SOURCE_PDF]) {
    if (!existsSync(path)) throw new Error(`missing required input: ${path}`);
  }

  const lastUpdated = readLastUpdated();
  const { header, rows } = parseCsv(readFileSync(SOURCE_CSV, 'utf8'));
  const records = validateRecords(header, rows);
  const artifacts = buildArtifacts(records, lastUpdated);
  const sizes = assertSizeBudget(artifacts);

  // Rewrite from scratch so a removed row can never linger in a stale shard.
  rmSync(OUT_DATA, { recursive: true, force: true });
  rmSync(OUT_DOWNLOADS, { recursive: true, force: true });
  mkdirSync(join(OUT_DATA, 'abstracts'), { recursive: true });
  mkdirSync(OUT_DOWNLOADS, { recursive: true });

  writeFileSync(join(OUT_DATA, 'index.json'), JSON.stringify(artifacts.index));
  for (const [s, shard] of artifacts.shards.entries()) {
    writeFileSync(join(OUT_DATA, 'abstracts', shardFileName(s)), JSON.stringify(shard));
  }
  writeFileSync(
    join(OUT_DOWNLOADS, `abcd-pubs_unfiltered_${lastUpdated}.csv`),
    artifacts.unfilteredCsv,
  );
  copyFileSync(SOURCE_PDF, join(OUT_DOWNLOADS, 'abcd-pubs_data-document.pdf'));

  console.log(`prep: ${records.length} records, last updated ${lastUpdated}`);
  console.log(
    `  index.json        ${kb(sizes.indexGzip)} gzipped (budget ${kb(SIZE_BUDGET.indexBytes)})`,
  );
  console.log(
    `  largest shard     ${kb(sizes.shardGzipMax)} gzipped (budget ${kb(SIZE_BUDGET.shardBytes)})`,
  );
  console.log(`  unfiltered CSV    ${kb(sizes.unfilteredGzip)} gzipped`);
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
