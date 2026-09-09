import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  DOMAINS,
  EXPORT_COLUMNS,
  SHARD_COUNT,
  type StudyGroup,
  shardIndexFor,
} from '../web/lib/data';
import { parseCsv } from './csv';
import { assertSizeBudget, buildArtifacts, SizeBudgetError, warnCrossStudyUrls } from './prep';

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
    r['Study.member'] = i % 2 === 0 ? 'yes' : 'no';
    r.MRI = '1';
    r.Domains = 'MRI';
    r['# domains'] = '1';
    return r;
  });
}

/** The common shape: one study with rows, one still awaiting its first publications. */
function groups(n: number): StudyGroup[] {
  return [
    { study: 'abcd', records: records(n) },
    { study: 'hbcd', records: [] },
  ];
}

describe('buildArtifacts', () => {
  const src = records(100);
  const art = buildArtifacts([{ study: 'abcd', records: src }], '2026-07-06');

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
    expect(parsed.header).toEqual([...EXPORT_COLUMNS]);
    expect(parsed.rows).toHaveLength(src.length);
    for (let r = 0; r < src.length; r++) {
      expect(parsed.rows[r]?.[0]).toBe('ABCD');
      for (const [c, name] of COLUMNS.entries()) {
        expect(parsed.rows[r]?.[c + 1]).toBe(src[r]?.[name]);
      }
    }
  });
});

describe('a study with no publications yet (spec §1.1)', () => {
  const art = buildArtifacts(groups(100), '2026-07-06');

  it('publishes the rows of the studies that do have data', () => {
    expect(art.index.rowCount).toBe(100);
    expect(art.index.cols.study.every((s) => s === 0)).toBe(true);
  });

  it('still lists the empty study, so it gets a filter checkbox and a banner', () => {
    expect(art.index.studies).toEqual(['abcd', 'hbcd']);
  });

  it('leaves shard assignment identical to the single-study build', () => {
    const solo = buildArtifacts([{ study: 'abcd', records: records(100) }], '2026-07-06');
    expect(art.shards).toEqual(solo.shards);
    expect(art.index.shardSize).toBe(solo.index.shardSize);
  });
});

describe('warnCrossStudyUrls (spec §3.5)', () => {
  it('says nothing when every URL belongs to one study', () => {
    expect(warnCrossStudyUrls(groups(10))).toEqual([]);
  });

  it('names both studies when a paper uses two datasets', () => {
    const shared = records(1);
    const warnings = warnCrossStudyUrls([
      { study: 'abcd', records: records(3) },
      { study: 'hbcd', records: shared },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('abcd and hbcd');
    expect(warnings[0]).toContain(shared[0]?.URL as string);
  });
});

describe('assertSizeBudget', () => {
  const tiny = buildArtifacts(groups(10), '2026-07-06');

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
