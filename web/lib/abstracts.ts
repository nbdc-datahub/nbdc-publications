// Lazy abstract loading (spec §3.2 / §4.3).
//
// Abstracts are 75% of the dataset's bytes and are needed by almost no page view, so they
// never ship with the page. Opening one modal pulls a single ~30 KB shard; a filtered export
// pulls all 32 once and reuses whatever the modals already fetched.

import { SHARD_COUNT, shardIndexFor } from './data';
import { loadShard } from './load';

export type ShardLoader = (shard: number) => Promise<string[]>;

export class AbstractStore {
  private readonly shards = new Map<number, string[]>();
  private readonly inFlight = new Map<number, Promise<string[]>>();

  constructor(
    private readonly rowCount: number,
    private readonly shardSize: number,
    private readonly load: ShardLoader = loadShard,
  ) {}

  private async shard(shard: number): Promise<string[]> {
    const cached = this.shards.get(shard);
    if (cached) return cached;

    const pending = this.inFlight.get(shard);
    if (pending) return pending;

    const request = this.load(shard)
      .then((abstracts) => {
        this.shards.set(shard, abstracts);
        return abstracts;
      })
      .finally(() => {
        // Drop the in-flight entry either way, so a failure can be retried.
        this.inFlight.delete(shard);
      });

    this.inFlight.set(shard, request);
    return request;
  }

  has(rowIndex: number): boolean {
    return this.shards.has(shardIndexFor(rowIndex, this.shardSize).shard);
  }

  async get(rowIndex: number): Promise<string> {
    const { shard, offset } = shardIndexFor(rowIndex, this.shardSize);
    const abstracts = await this.shard(shard);
    return abstracts[offset] ?? '';
  }

  /** Every abstract, indexed by absolute row index. Used only by exports. */
  async all(): Promise<string[]> {
    const shards = await Promise.all(Array.from({ length: SHARD_COUNT }, (_, s) => this.shard(s)));
    const out: string[] = new Array(this.rowCount).fill('');
    for (const [s, abstracts] of shards.entries()) {
      for (const [offset, abstract] of abstracts.entries()) {
        const row = s * this.shardSize + offset;
        if (row < this.rowCount) out[row] = abstract;
      }
    }
    return out;
  }
}
