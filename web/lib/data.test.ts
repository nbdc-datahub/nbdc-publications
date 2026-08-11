import { describe, expect, it } from 'vitest';
import {
  buildExportRows,
  COLUMNS,
  DOMAINS,
  decodeRows,
  encodeIndex,
  SHARD_COUNT,
  shardIndexFor,
  shardSizeFor,
} from './data';

/** Builds a full 46-column record: '' everywhere, '0' for the domain flags (as in real data). */
function makeRecord(over: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const c of COLUMNS) r[c] = '';
  for (const d of DOMAINS) r[d] = '0';
  return { ...r, ...over };
}

const BASE = [
  makeRecord({
    'Pub.Year': '2018',
    'Pub.Date': '2018-08-01',
    Title: 'A title, with a comma',
    Authors: 'Luciana, M;Bjork, J M',
    Abstract: 'Line one\nLine two with "quotes"',
    'Journal.Name': 'Developmental cognitive neuroscience',
    URL: 'https://doi.org/10.1/a',
    'ABCD.member': 'yes',
    Domains: 'NeuroCognition',
    NeuroCognition: '1',
    '# domains': '1',
    PMID: '29525452',
    RCR: '23.69',
  }),
  makeRecord({
    'Pub.Year': '2026',
    Title: 'Second',
    Authors: '',
    Abstract: '',
    'Journal.Name': 'JAMA psychiatry',
    URL: 'https://doi.org/10.1/b',
    'ABCD.member': 'no',
    Domains: 'MRI;Substance Use',
    MRI: '1',
    'Substance Use': '1',
    '# domains': '2',
    RCR: '1.0',
  }),
];

describe('COLUMNS / DOMAINS', () => {
  it('describes the 46-column contract with the 10 domains inside it', () => {
    expect(COLUMNS).toHaveLength(46);
    expect(DOMAINS).toHaveLength(10);
    expect(new Set(COLUMNS).size).toBe(46);
    for (const d of DOMAINS) expect(COLUMNS).toContain(d);
  });
});

describe('encodeIndex', () => {
  it('captures meta, the journal dictionary and the domain bitmask', () => {
    const idx = encodeIndex(BASE, '2026-07-06');
    expect(idx.rowCount).toBe(2);
    expect(idx.lastUpdated).toBe('2026-07-06');
    expect(idx.yearMin).toBe(2018);
    expect(idx.yearMax).toBe(2026);
    expect(idx.journals).toEqual(['Developmental cognitive neuroscience', 'JAMA psychiatry']);
    expect(idx.cols.journal).toEqual([0, 1]);
    expect(idx.cols.member).toEqual([1, 0]);
    // bit i == DOMAINS[i]
    expect(idx.cols.domainMask[0]).toBe(1 << DOMAINS.indexOf('NeuroCognition'));
    expect(idx.cols.domainMask[1]).toBe(
      (1 << DOMAINS.indexOf('MRI')) | (1 << DOMAINS.indexOf('Substance Use')),
    );
  });

  it('never stores abstracts in the index', () => {
    const idx = encodeIndex(BASE, '2026-07-06');
    expect(JSON.stringify(idx)).not.toContain('Line one');
    expect(Object.keys(idx.cols.extra)).not.toContain('Abstract');
  });

  it('packs a column as numbers only when String(Number(v)) round-trips exactly', () => {
    const idx = encodeIndex(BASE, '2026-07-06');
    // PMID: '29525452' and '' → packable
    expect(idx.cols.extra.PMID).toEqual([29525452, '']);
    // RCR: '1.0' does not survive Number→String, so the whole column stays strings
    expect(idx.cols.extra.RCR).toEqual(['23.69', '1.0']);
  });
});

describe('decodeRows', () => {
  it('produces UI rows with the journal resolved from the dictionary', () => {
    const rows = decodeRows(encodeIndex(BASE, '2026-07-06'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      i: 0,
      year: 2018,
      title: 'A title, with a comma',
      journal: 'Developmental cognitive neuroscience',
      member: 'yes',
      url: 'https://doi.org/10.1/a',
    });
    expect(rows[1]?.member).toBe('no');
  });
});

describe('buildExportRows', () => {
  it('reconstructs the source records field-for-field, in the original column order', () => {
    const idx = encodeIndex(BASE, '2026-07-06');
    const abstracts = BASE.map((r) => r.Abstract as string);
    const out = buildExportRows(idx, [0, 1], abstracts);
    for (let r = 0; r < BASE.length; r++) {
      for (let c = 0; c < COLUMNS.length; c++) {
        expect(`${COLUMNS[c]}=${out[r]?.[c]}`).toBe(
          `${COLUMNS[c]}=${BASE[r]?.[COLUMNS[c] as string]}`,
        );
      }
    }
  });

  it('exports only the requested rows, in the requested order', () => {
    const idx = encodeIndex(BASE, '2026-07-06');
    const abstracts = BASE.map((r) => r.Abstract as string);
    const out = buildExportRows(idx, [1], abstracts);
    expect(out).toHaveLength(1);
    expect(out[0]?.[COLUMNS.indexOf('URL')]).toBe('https://doi.org/10.1/b');
  });
});

describe('sharding', () => {
  it('splits rows into SHARD_COUNT buckets that cover every index exactly once', () => {
    const rowCount = 1848;
    const size = shardSizeFor(rowCount);
    expect(size).toBe(Math.ceil(rowCount / SHARD_COUNT));
    const seen = new Set<number>();
    for (let i = 0; i < rowCount; i++) {
      const { shard, offset } = shardIndexFor(i, size);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(SHARD_COUNT);
      expect(offset).toBeLessThan(size);
      seen.add(shard * size + offset);
    }
    expect(seen.size).toBe(rowCount);
  });

  it('never returns a zero shard size for a tiny dataset', () => {
    expect(shardSizeFor(1)).toBe(1);
    expect(shardIndexFor(0, shardSizeFor(1))).toEqual({ shard: 0, offset: 0 });
  });
});
