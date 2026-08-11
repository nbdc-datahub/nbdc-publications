// Fetching the published artifacts (spec §3.2). Manual fetches are NOT prefixed with the
// basePath by Next, so every URL here goes through withBasePath.

import { withBasePath } from './base-path';
import type { PubIndex } from './data';
import { shardFileName } from './data';

export const DATA_INDEX_PATH = withBasePath('/data/index.json');

export function shardPath(shard: number): string {
  return withBasePath(`/data/abstracts/${shardFileName(shard)}`);
}

/** Long-lived immutable artifacts; let the browser cache them. */
const FETCH_INIT: RequestInit = { cache: 'force-cache' };

async function fetchJson(path: string, label: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(path, FETCH_INIT);
  if (!response.ok) {
    throw new Error(`could not load ${label} (HTTP ${response.status}). Was \`npm run prep\` run?`);
  }
  return response.json();
}

function isPubIndex(value: unknown): value is PubIndex {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<PubIndex>;
  return (
    typeof v.rowCount === 'number' &&
    typeof v.shardSize === 'number' &&
    Array.isArray(v.journals) &&
    typeof v.cols === 'object' &&
    v.cols !== null &&
    Array.isArray(v.cols.domainMask)
  );
}

export async function loadIndex(fetchImpl: typeof fetch = fetch): Promise<PubIndex> {
  const payload = await fetchJson(DATA_INDEX_PATH, 'index.json', fetchImpl);
  if (!isPubIndex(payload)) {
    throw new Error('index.json is not a publication index — the published data looks corrupt.');
  }
  return payload;
}

export async function loadShard(shard: number, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const name = shardFileName(shard);
  const payload = await fetchJson(shardPath(shard), name, fetchImpl);
  if (!Array.isArray(payload) || payload.some((a) => typeof a !== 'string')) {
    throw new Error(`${name} is not an array of abstracts — the published data looks corrupt.`);
  }
  return payload as string[];
}
