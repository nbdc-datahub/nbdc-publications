// Fetching the published artifacts (spec §3.2). Manual fetches are NOT prefixed with the
// basePath by Next, so every URL here goes through withBasePath.

import { withBasePath } from './base-path';
import type { PubIndex } from './data';
import { shardFileName } from './data';

export const DATA_INDEX_PATH = withBasePath('/data/index.json');

export function shardPath(shard: number): string {
  return withBasePath(`/data/abstracts/${shardFileName(shard)}`);
}

/**
 * Normal HTTP caching — deliberately NOT `force-cache`.
 *
 * These artifacts live at STABLE urls (/data/index.json never changes name) but their
 * CONTENTS change on every republish, so they are not immutable. `force-cache` returns a
 * cached match "fresh or stale", ignoring both max-age and the ETag, which pinned returning
 * visitors to whatever payload they first downloaded — forever. When the index gained the
 * multi-study columns, every such visitor kept decoding the old shape and the page died with
 * "Cannot read properties of undefined".
 *
 * Next's own `_next/static/*` files ARE content-hashed, so aggressive caching is right for
 * them. These are not. Default caching honours Pages' `max-age=600` and revalidates against
 * the ETag afterwards, so staleness is bounded and self-correcting.
 */
const FETCH_INIT: RequestInit = {};

/** Bypasses the HTTP cache entirely — used to recover from a poisoned cache entry. */
const FETCH_REVALIDATE: RequestInit = { cache: 'reload' };

async function fetchJson(
  path: string,
  label: string,
  fetchImpl: typeof fetch,
  init: RequestInit = FETCH_INIT,
): Promise<unknown> {
  const response = await fetchImpl(path, init);
  if (!response.ok) {
    throw new Error(`could not load ${label} (HTTP ${response.status}). Was \`npm run prep\` run?`);
  }
  return response.json();
}

/**
 * Checks every field the app actually dereferences — the decoder, the dashboard and the
 * download panel. It previously checked a subset, which is why a payload from an older
 * schema passed validation and then crashed the decoder with an unreadable TypeError
 * instead of failing here with a sentence.
 *
 * Keep this in step with `encodeIndex`: too loose and a bad payload reaches the UI, too
 * strict and a perfectly good one is rejected. `load.test.ts` pins both directions.
 */
function isPubIndex(value: unknown): value is PubIndex {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<PubIndex>;
  return (
    typeof v.rowCount === 'number' &&
    typeof v.shardSize === 'number' &&
    typeof v.lastUpdated === 'string' &&
    typeof v.yearMin === 'number' &&
    typeof v.yearMax === 'number' &&
    Array.isArray(v.columns) &&
    Array.isArray(v.domains) &&
    Array.isArray(v.journals) &&
    Array.isArray(v.studies) &&
    Array.isArray(v.documentation) &&
    typeof v.cols === 'object' &&
    v.cols !== null &&
    Array.isArray(v.cols.study) &&
    Array.isArray(v.cols.domainMask)
  );
}

export async function loadIndex(fetchImpl: typeof fetch = fetch): Promise<PubIndex> {
  const payload = await fetchJson(DATA_INDEX_PATH, 'index.json', fetchImpl);
  if (isPubIndex(payload)) return payload;

  // The shape is wrong. By far the likeliest cause is a cached copy from an older release,
  // so go back to the network past the cache before giving up.
  const fresh = await fetchJson(DATA_INDEX_PATH, 'index.json', fetchImpl, FETCH_REVALIDATE);
  if (isPubIndex(fresh)) return fresh;

  throw new Error(
    'index.json is out of date or corrupt, and re-fetching it returned the same thing. ' +
      'Reload the page; if that does not help, the published data needs regenerating.',
  );
}

export async function loadShard(shard: number, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const name = shardFileName(shard);
  const payload = await fetchJson(shardPath(shard), name, fetchImpl);
  if (!Array.isArray(payload) || payload.some((a) => typeof a !== 'string')) {
    throw new Error(`${name} is not an array of abstracts — the published data looks corrupt.`);
  }
  return payload as string[];
}
