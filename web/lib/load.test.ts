import { describe, expect, it, vi } from 'vitest';
import { encodeIndex } from './data';
import { DATA_INDEX_PATH, loadIndex, loadShard, shardPath } from './load';

const INDEX = encodeIndex(
  [
    {
      study: 'abcd',
      records: [
        {
          'Pub.Year': '2020',
          Title: 'T',
          Authors: 'A',
          'Journal.Name': 'J',
          URL: 'u',
          'Study.member': 'yes',
        },
      ],
    },
  ],
  '2026-07-06',
);

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

describe('loadIndex', () => {
  it('fetches the published index and returns it decoded', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(INDEX));
    const index = await loadIndex(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(DATA_INDEX_PATH, expect.anything());
    expect(index.rowCount).toBe(1);
  });

  it('throws a message naming the path when the file is missing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, { ok: false, status: 404 }));
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/404/);
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/index\.json/);
  });

  it('surfaces a network failure rather than resolving with junk', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /Failed to fetch/,
    );
  });

  it('rejects a payload that is not a publication index', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ nope: true }));
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/index\.json/);
  });
});

describe('loadShard', () => {
  it('requests the zero-padded shard file', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(['a', 'b']));
    const shard = await loadShard(7, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(shardPath(7), expect.anything());
    expect(shardPath(7)).toContain('/07.json');
    expect(shard).toEqual(['a', 'b']);
  });

  it('throws when a shard is missing instead of returning undefined abstracts', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, { ok: false, status: 404 }));
    await expect(loadShard(3, fetchImpl as unknown as typeof fetch)).rejects.toThrow(/03\.json/);
  });

  it('rejects a shard payload that is not an array of strings', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ 0: 'a' }));
    await expect(loadShard(0, fetchImpl as unknown as typeof fetch)).rejects.toThrow(/00\.json/);
  });
});
