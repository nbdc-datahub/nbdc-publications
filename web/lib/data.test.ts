import { describe, expect, it } from 'vitest';
import {
  buildExportRows,
  COLUMNS,
  DOMAINS,
  decodeRows,
  EXPORT_COLUMNS,
  encodeIndex,
  MEMBER_COLUMN,
  rowKey,
  SHARD_COUNT,
  STUDIES,
  STUDY_COLUMN,
  shardIndexFor,
  shardSizeFor,
  studyLabel,
} from './data';

/** Builds a full 46-column record: '' everywhere, '0' for the domain flags (as in real data). */
function makeRecord(over: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const c of COLUMNS) r[c] = '';
  for (const d of DOMAINS) r[d] = '0';
  return { ...r, ...over };
}

const ABCD_RECORDS = [
  makeRecord({
    'Pub.Year': '2018',
    'Pub.Date': '2018-08-01',
    Title: 'A title, with a comma',
    Authors: 'Luciana, M;Bjork, J M',
    Abstract: 'Line one\nLine two with "quotes"',
    'Journal.Name': 'Developmental cognitive neuroscience',
    URL: 'https://doi.org/10.1/a',
    'Study.member': 'yes',
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
    'Study.member': 'no',
    Domains: 'MRI;Substance Use',
    MRI: '1',
    'Substance Use': '1',
    '# domains': '2',
    RCR: '1.0',
  }),
];

const HBCD_RECORDS = [
  makeRecord({
    'Pub.Year': '2025',
    Title: 'An HBCD paper',
    'Journal.Name': 'JAMA psychiatry',
    // Deliberately the same URL as an ABCD row: a paper may use both datasets (spec §3.5).
    URL: 'https://doi.org/10.1/a',
    'Study.member': 'yes',
    Domains: 'MRI',
    MRI: '1',
    '# domains': '1',
  }),
];

const ABCD_ONLY = [{ study: 'abcd', records: ABCD_RECORDS }] as const;
const BOTH = [
  { study: 'abcd', records: ABCD_RECORDS },
  { study: 'hbcd', records: HBCD_RECORDS },
] as const;

describe('the column contract', () => {
  it('describes the 46-column contract with the 10 domains inside it', () => {
    expect(COLUMNS).toHaveLength(46);
    expect(DOMAINS).toHaveLength(10);
    expect(new Set(COLUMNS).size).toBe(46);
    for (const d of DOMAINS) expect(COLUMNS).toContain(d);
  });

  it('names the membership flag study-neutrally (spec §3.1)', () => {
    expect(MEMBER_COLUMN).toBe('Study.member');
    expect(COLUMNS).toContain('Study.member');
    expect(COLUMNS).not.toContain('ABCD.member');
  });

  it('has no study-specific column name at all — a new study is a data drop', () => {
    for (const column of COLUMNS) {
      for (const study of STUDIES) {
        expect(column).not.toContain(study.label);
      }
    }
  });

  it('prepends a derived Study column for exports, 47 wide', () => {
    expect(EXPORT_COLUMNS).toHaveLength(47);
    expect(EXPORT_COLUMNS[0]).toBe(STUDY_COLUMN);
    expect(EXPORT_COLUMNS.slice(1)).toEqual([...COLUMNS]);
    // The source files must NOT carry it — a row's study comes from its file.
    expect(COLUMNS).not.toContain(STUDY_COLUMN);
  });
});

describe('STUDIES', () => {
  it('declares ABCD and HBCD with labels and full names', () => {
    expect(STUDIES.map((s) => s.id)).toEqual(['abcd', 'hbcd']);
    expect(studyLabel('abcd')).toBe('ABCD');
    expect(studyLabel('hbcd')).toBe('HBCD');
    for (const study of STUDIES) expect(study.name).toMatch(/Study$/);
  });
});

describe('encodeIndex', () => {
  it('captures meta, the journal dictionary and the domain bitmask', () => {
    const idx = encodeIndex(ABCD_ONLY, '2026-07-06');
    expect(idx.rowCount).toBe(2);
    expect(idx.lastUpdated).toBe('2026-07-06');
    expect(idx.yearMin).toBe(2018);
    expect(idx.yearMax).toBe(2026);
    expect(idx.journals).toEqual(['Developmental cognitive neuroscience', 'JAMA psychiatry']);
    expect(idx.cols.journal).toEqual([0, 1]);
    expect(idx.cols.member).toEqual([1, 0]);
    expect(idx.cols.domainMask[0]).toBe(1 << DOMAINS.indexOf('NeuroCognition'));
    expect(idx.cols.domainMask[1]).toBe(
      (1 << DOMAINS.indexOf('MRI')) | (1 << DOMAINS.indexOf('Substance Use')),
    );
  });

  it('lists every declared study and tags each row with its own', () => {
    const idx = encodeIndex(BOTH, '2026-07-06');
    expect(idx.studies).toEqual(['abcd', 'hbcd']);
    expect(idx.cols.study).toEqual([0, 0, 1]);
    expect(idx.rowCount).toBe(3);
  });

  it('still lists an empty study, so the banner and filter can see it', () => {
    const idx = encodeIndex(
      [
        { study: 'abcd', records: ABCD_RECORDS },
        { study: 'hbcd', records: [] },
      ],
      '2026-07-06',
    );
    expect(idx.studies).toEqual(['abcd', 'hbcd']);
    expect(idx.cols.study).toEqual([0, 0]);
  });

  it('concatenates studies in declaration order, so shard assignment is deterministic', () => {
    const idx = encodeIndex(BOTH, '2026-07-06');
    expect(idx.cols.title).toEqual(['A title, with a comma', 'Second', 'An HBCD paper']);
  });

  it('never stores abstracts in the index', () => {
    const idx = encodeIndex(ABCD_ONLY, '2026-07-06');
    expect(JSON.stringify(idx)).not.toContain('Line one');
    expect(Object.keys(idx.cols.extra)).not.toContain('Abstract');
  });

  it('packs a column as numbers only when String(Number(v)) round-trips exactly', () => {
    const idx = encodeIndex(ABCD_ONLY, '2026-07-06');
    expect(idx.cols.extra.PMID).toEqual([29525452, '']);
    expect(idx.cols.extra.RCR).toEqual(['23.69', '1.0']);
  });
});

describe('decodeRows', () => {
  it('produces UI rows with the journal resolved from the dictionary', () => {
    const rows = decodeRows(encodeIndex(ABCD_ONLY, '2026-07-06'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      i: 0,
      year: 2018,
      title: 'A title, with a comma',
      journal: 'Developmental cognitive neuroscience',
      member: 'yes',
      url: 'https://doi.org/10.1/a',
      study: 'abcd',
    });
    expect(rows[1]?.member).toBe('no');
  });

  it('keys the same URL in two studies as two distinct rows (spec §3.5)', () => {
    const rows = decodeRows(encodeIndex(BOTH, '2026-07-06'));
    const shared = rows.filter((r) => r.url === 'https://doi.org/10.1/a');
    expect(shared).toHaveLength(2);
    expect(shared.map((r) => r.key)).toEqual([
      'abcd:https://doi.org/10.1/a',
      'hbcd:https://doi.org/10.1/a',
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
});

describe('rowKey', () => {
  it('composes study and URL', () => {
    expect(rowKey('abcd', 'https://doi.org/10.1/a')).toBe('abcd:https://doi.org/10.1/a');
  });
});

describe('buildExportRows', () => {
  it('reconstructs the source records field-for-field after the derived Study column', () => {
    const idx = encodeIndex(ABCD_ONLY, '2026-07-06');
    const abstracts = ABCD_RECORDS.map((r) => r.Abstract as string);
    const out = buildExportRows(idx, [0, 1], abstracts);
    for (let r = 0; r < ABCD_RECORDS.length; r++) {
      expect(out[r]).toHaveLength(47);
      expect(out[r]?.[0]).toBe('ABCD');
      for (let c = 0; c < COLUMNS.length; c++) {
        expect(`${COLUMNS[c]}=${out[r]?.[c + 1]}`).toBe(
          `${COLUMNS[c]}=${ABCD_RECORDS[r]?.[COLUMNS[c] as string]}`,
        );
      }
    }
  });

  it('labels each row with its own study', () => {
    const idx = encodeIndex(BOTH, '2026-07-06');
    const out = buildExportRows(idx, [0, 1, 2], ['', '', '']);
    expect(out.map((r) => r[0])).toEqual(['ABCD', 'ABCD', 'HBCD']);
  });

  it('keeps Study.member at its source position, one past the derived column', () => {
    const idx = encodeIndex(ABCD_ONLY, '2026-07-06');
    const out = buildExportRows(idx, [0], ['']);
    expect(EXPORT_COLUMNS.indexOf(MEMBER_COLUMN)).toBe(COLUMNS.indexOf(MEMBER_COLUMN) + 1);
    expect(out[0]?.[EXPORT_COLUMNS.indexOf(MEMBER_COLUMN)]).toBe('yes');
  });

  it('exports only the requested rows, in the requested order', () => {
    const idx = encodeIndex(ABCD_ONLY, '2026-07-06');
    const abstracts = ABCD_RECORDS.map((r) => r.Abstract as string);
    const out = buildExportRows(idx, [1], abstracts);
    expect(out).toHaveLength(1);
    expect(out[0]?.[EXPORT_COLUMNS.indexOf('URL')]).toBe('https://doi.org/10.1/b');
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
