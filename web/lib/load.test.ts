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

/**
 * The payload a returning visitor had cached before the multi-study change: no `studies`,
 * no `cols.study`. This is what took production down — the guard passed it through and
 * decodeRows then threw "Cannot read properties of undefined (reading '0')".
 */
function staleIndex(): unknown {
  const stale = structuredClone(INDEX) as unknown as Record<string, unknown>;
  delete stale.studies;
  delete (stale.cols as Record<string, unknown>).study;
  delete stale.documentation;
  return stale;
}

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

describe('the writer/reader contract', () => {
  it('accepts exactly what encodeIndex produces', async () => {
    // The guard is load-bearing in both directions: too loose and a stale payload reaches
    // the UI (the outage), too strict and every visitor is locked out of good data.
    const fetchImpl = vi.fn(async () => jsonResponse(INDEX));
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({
      rowCount: INDEX.rowCount,
      studies: INDEX.studies,
    });
  });
});

describe('a stale cached index (the production outage)', () => {
  it('is rejected rather than passed to the decoder', async () => {
    // One shot only: the retry gets the same stale body, so loadIndex must give up loudly.
    const fetchImpl = vi.fn(async () => jsonResponse(staleIndex()));
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/out of date/i);
  });

  it('names the reload, so the message tells a user what to do', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(staleIndex()));
    await expect(loadIndex(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/reload/i);
  });

  it('retries once past the HTTP cache and recovers when the server has fresh data', async () => {
    const fetchImpl = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.cache === 'reload' ? jsonResponse(INDEX) : jsonResponse(staleIndex()),
    );
    const index = await loadIndex(fetchImpl as unknown as typeof fetch);
    expect(index.rowCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ cache: 'reload' });
  });

  it('does not retry when the first response is already valid', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(INDEX));
    await loadIndex(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('the caching policy (root cause of the outage)', () => {
  it('never uses force-cache — these files are mutable and live at stable URLs', async () => {
    const fetchImpl = vi.fn(async (path: string, _init?: RequestInit) =>
      jsonResponse(path === DATA_INDEX_PATH ? INDEX : ['abstract']),
    );
    await loadIndex(fetchImpl as unknown as typeof fetch);
    await loadShard(0, fetchImpl as unknown as typeof fetch);
    for (const call of fetchImpl.mock.calls) {
      expect((call[1] as RequestInit | undefined)?.cache).not.toBe('force-cache');
    }
  });
});
