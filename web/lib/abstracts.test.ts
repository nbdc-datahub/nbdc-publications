import { describe, expect, it, vi } from 'vitest';
import { AbstractStore } from './abstracts';
import { SHARD_COUNT, shardSizeFor } from './data';

const ROW_COUNT = 100;
const SHARD_SIZE = shardSizeFor(ROW_COUNT); // 4

/** Loader that returns "shard<S>:<offset>" so we can assert exact placement. */
function loader() {
  return vi.fn(async (shard: number) =>
    Array.from({ length: SHARD_SIZE }, (_, o) => `shard${shard}:${o}`),
  );
}

const store = () => {
  const load = loader();
  return { load, s: new AbstractStore(ROW_COUNT, SHARD_SIZE, load) };
};

describe('AbstractStore.get', () => {
  it('fetches the shard containing the row and returns that row’s abstract', async () => {
    const { load, s } = store();
    expect(await s.get(9)).toBe('shard2:1'); // 9 = 2 * 4 + 1
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(2);
  });

  it('fetches each shard at most once, however many rows are read from it', async () => {
    const { load, s } = store();
    await s.get(8);
    await s.get(9);
    await s.get(10);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not issue a second request while the first is still in flight', async () => {
    const { load, s } = store();
    await Promise.all([s.get(8), s.get(9), s.get(10)]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports whether a row is already cached', async () => {
    const { s } = store();
    expect(s.has(8)).toBe(false);
    await s.get(8);
    expect(s.has(8)).toBe(true);
    expect(s.has(80)).toBe(false);
  });

  it('lets a failed fetch be retried instead of caching the failure', async () => {
    let calls = 0;
    const load = vi.fn(async (shard: number) => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return Array.from({ length: SHARD_SIZE }, (_, o) => `shard${shard}:${o}`);
    });
    const s = new AbstractStore(ROW_COUNT, SHARD_SIZE, load);
    await expect(s.get(0)).rejects.toThrow('offline');
    expect(await s.get(0)).toBe('shard0:0');
  });
});

describe('AbstractStore.all', () => {
  it('fetches every shard once and returns a full-length, row-indexed array', async () => {
    const { load, s } = store();
    const all = await s.all();
    expect(load).toHaveBeenCalledTimes(SHARD_COUNT);
    expect(all).toHaveLength(ROW_COUNT);
    expect(all[0]).toBe('shard0:0');
    expect(all[9]).toBe('shard2:1');
    expect(all[ROW_COUNT - 1]).toBe(
      `shard${Math.floor((ROW_COUNT - 1) / SHARD_SIZE)}:${(ROW_COUNT - 1) % SHARD_SIZE}`,
    );
  });

  it('reuses shards already pulled in by the abstract modal', async () => {
    const { load, s } = store();
    await s.get(9);
    load.mockClear();
    await s.all();
    expect(load).toHaveBeenCalledTimes(SHARD_COUNT - 1);
  });
});
