import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/csv';
import { COLUMNS, DOMAINS, encodeIndex } from './data';
import { buildCsv, exportFileName, UNFILTERED_PATH } from './export';

function record(over: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const c of COLUMNS) r[c] = '';
  for (const d of DOMAINS) r[d] = '0';
  return { ...r, 'Pub.Year': '2020', 'ABCD.member': 'yes', ...over };
}

const RECORDS = [
  record({ Title: 'First, with comma', URL: 'u0', Abstract: 'A0', 'Journal.Name': 'J' }),
  record({ Title: 'Second "quoted"', URL: 'u1', Abstract: 'A1\nline', 'Journal.Name': 'J' }),
];
const INDEX = encodeIndex(RECORDS, '2026-07-06');
const ABSTRACTS = RECORDS.map((r) => r.Abstract as string);

describe('exportFileName', () => {
  it('matches the Shiny app’s names, dating exports by day and the full file by snapshot', () => {
    expect(exportFileName('filtered', '2026-08-11', '2026-07-06')).toBe(
      'abcd-pubs_filtered_2026-08-11.csv',
    );
    expect(exportFileName('search', '2026-08-11', '2026-07-06')).toBe(
      'abcd-pubs_search_2026-08-11.csv',
    );
    expect(exportFileName('selected', '2026-08-11', '2026-07-06')).toBe(
      'abcd-pubs_selected_2026-08-11.csv',
    );
    expect(exportFileName('unfiltered', '2026-08-11', '2026-07-06')).toBe(
      'abcd-pubs_unfiltered_2026-07-06.csv',
    );
  });
});

describe('UNFILTERED_PATH', () => {
  it('points at the prebuilt static file so the full export costs no JS', () => {
    expect(UNFILTERED_PATH('2026-07-06')).toContain(
      '/downloads/abcd-pubs_unfiltered_2026-07-06.csv',
    );
  });
});

describe('buildCsv', () => {
  it('writes all 46 columns in source order with the abstracts filled in', () => {
    const parsed = parseCsv(buildCsv(INDEX, [0, 1], ABSTRACTS));
    expect(parsed.header).toEqual([...COLUMNS]);
    expect(parsed.rows).toHaveLength(2);
    const abstractCol = COLUMNS.indexOf('Abstract');
    expect(parsed.rows[0]?.[abstractCol]).toBe('A0');
    expect(parsed.rows[1]?.[abstractCol]).toBe('A1\nline');
    expect(parsed.rows[0]?.[COLUMNS.indexOf('Title')]).toBe('First, with comma');
    expect(parsed.rows[1]?.[COLUMNS.indexOf('Title')]).toBe('Second "quoted"');
  });

  it('exports only the requested rows', () => {
    const parsed = parseCsv(buildCsv(INDEX, [1], ABSTRACTS));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.[COLUMNS.indexOf('URL')]).toBe('u1');
  });

  it('writes a header-only file when nothing matches, rather than an empty file', () => {
    const parsed = parseCsv(buildCsv(INDEX, [], ABSTRACTS));
    expect(parsed.header).toEqual([...COLUMNS]);
    expect(parsed.rows).toHaveLength(0);
  });
});
