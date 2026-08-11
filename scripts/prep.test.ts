import { describe, expect, it } from 'vitest';
import { COLUMNS, DOMAINS, SHARD_COUNT, shardIndexFor } from '../web/lib/data';
import { parseCsv } from './csv';
import { assertSizeBudget, buildArtifacts, SizeBudgetError } from './prep';

function records(n: number): Record<string, string>[] {
  return Array.from({ length: n }, (_, i) => {
    const r: Record<string, string> = {};
    for (const c of COLUMNS) r[c] = '';
    for (const d of DOMAINS) r[d] = '0';
    r['Pub.Year'] = String(2018 + (i % 9));
    r.Title = `Title ${i}, with comma`;
    r.Authors = `Author ${i}`;
    r.Abstract = i % 10 === 0 ? '' : `Abstract ${i}\nwith a newline and "quotes"`;
    r['Journal.Name'] = `Journal ${i % 7}`;
    r.URL = `https://doi.org/10.1/${i}`;
    r['ABCD.member'] = i % 2 === 0 ? 'yes' : 'no';
    r.MRI = '1';
    r.Domains = 'MRI';
    r['# domains'] = '1';
    return r;
  });
}

describe('buildArtifacts', () => {
  const src = records(100);
  const art = buildArtifacts(src, '2026-07-06');

  it('emits exactly SHARD_COUNT abstract shards', () => {
    expect(art.shards).toHaveLength(SHARD_COUNT);
  });

  it('places every row abstract at its computed shard/offset', () => {
    for (let i = 0; i < src.length; i++) {
      const { shard, offset } = shardIndexFor(i, art.index.shardSize);
      expect(art.shards[shard]?.[offset]).toBe(src[i]?.Abstract);
    }
  });

  it('reproduces the Abstract column when shards are concatenated in order', () => {
    expect(art.shards.flat().slice(0, src.length)).toEqual(src.map((r) => r.Abstract));
  });

  it('keeps abstracts out of the index entirely', () => {
    expect(JSON.stringify(art.index)).not.toContain('with a newline');
  });

  it('produces an unfiltered CSV that parses back to the source records', () => {
    const parsed = parseCsv(art.unfilteredCsv);
    expect(parsed.header).toEqual([...COLUMNS]);
    expect(parsed.rows).toHaveLength(src.length);
    for (let r = 0; r < src.length; r++) {
      for (const [c, name] of COLUMNS.entries()) {
        expect(parsed.rows[r]?.[c]).toBe(src[r]?.[name]);
      }
    }
  });
});

describe('assertSizeBudget', () => {
  const tiny = buildArtifacts(records(10), '2026-07-06');

  it('passes when artifacts fit the budget', () => {
    expect(() =>
      assertSizeBudget(tiny, { indexBytes: 500_000, shardBytes: 100_000 }),
    ).not.toThrow();
  });

  it('fails when the index exceeds its gzipped budget', () => {
    expect(() => assertSizeBudget(tiny, { indexBytes: 10, shardBytes: 100_000 })).toThrow(
      SizeBudgetError,
    );
  });

  it('fails when any single shard exceeds its gzipped budget', () => {
    expect(() => assertSizeBudget(tiny, { indexBytes: 500_000, shardBytes: 1 })).toThrow(
      SizeBudgetError,
    );
  });

  it('reports measured sizes so the build log shows the headroom', () => {
    const report = assertSizeBudget(tiny, { indexBytes: 500_000, shardBytes: 100_000 });
    expect(report.indexGzip).toBeGreaterThan(0);
    expect(report.shardGzipMax).toBeGreaterThan(0);
  });
});
