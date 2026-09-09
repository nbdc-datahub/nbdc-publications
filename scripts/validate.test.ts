import { describe, expect, it } from 'vitest';
import { toCsv } from '../web/lib/csv';
import { COLUMNS, DOMAINS } from '../web/lib/data';
import { parseCsv } from './csv';
import { ValidationError, validateRecords } from './validate';

function row(over: Record<string, string> = {}): string[] {
  const base: Record<string, string> = {};
  for (const c of COLUMNS) base[c] = '';
  for (const d of DOMAINS) base[d] = '0';
  const filled: Record<string, string> = {
    ...base,
    'Pub.Year': '2020',
    Title: 'T',
    'Journal.Name': 'J',
    URL: 'https://doi.org/10.1/unique',
    'Study.member': 'yes',
    MRI: '1',
    ...over,
  };
  return COLUMNS.map((c) => filled[c] as string);
}

/** Builds a CSV, parses it back, and validates — the exact path prep.ts takes. */
function check(header: string[], rows: string[][], study = 'abcd') {
  const parsed = parseCsv(toCsv(header, rows));
  return validateRecords(study, parsed.header, parsed.rows);
}

describe('validateRecords', () => {
  it('accepts a well-formed table', () => {
    const records = check([...COLUMNS], [row(), row({ URL: 'https://doi.org/10.1/other' })]);
    expect(records).toHaveLength(2);
    expect(records[0]?.['Pub.Year']).toBe('2020');
  });

  it('rejects a missing column, naming it', () => {
    const header = COLUMNS.filter((c) => c !== 'Altmetric.Attention.Score');
    expect(() => check(header, [row().slice(0, header.length)])).toThrow(
      /Altmetric\.Attention\.Score/,
    );
  });

  it('rejects reordered columns, naming the position', () => {
    const header: string[] = [...COLUMNS];
    [header[0], header[1]] = [header[1] as string, header[0] as string];
    expect(() => check(header, [row()])).toThrow(ValidationError);
  });

  it('rejects a Study.member value outside {yes,no}, naming the column', () => {
    expect(() => check([...COLUMNS], [row({ 'Study.member': 'Yes' })])).toThrow(/Study\.member/);
  });

  it('rejects a non-integer publication year, naming the column', () => {
    expect(() => check([...COLUMNS], [row({ 'Pub.Year': '20xx' })])).toThrow(/Pub\.Year/);
  });

  it('rejects a domain flag outside {0,1}, naming the domain column', () => {
    expect(() => check([...COLUMNS], [row({ MRI: '2' })])).toThrow(/MRI/);
  });

  it('rejects duplicate URLs within one study, naming the column and the value', () => {
    expect(() => check([...COLUMNS], [row(), row()])).toThrow(/URL/);
  });

  it('rejects a row with the wrong number of fields', () => {
    expect(() => check([...COLUMNS], [row().slice(0, 45)])).toThrow(ValidationError);
  });

  it('names the offending study, so a two-study build says which file is wrong', () => {
    expect(() => check([...COLUMNS], [row({ 'Pub.Year': '20xx' })], 'hbcd')).toThrow(/hbcd/);
  });

  describe('the empty study (spec §1.1)', () => {
    it('accepts a header-only file — a study awaiting its first publications', () => {
      expect(check([...COLUMNS], [], 'hbcd')).toEqual([]);
    });

    it('still rejects a header-only file whose header is wrong', () => {
      const header = COLUMNS.filter((c) => c !== 'MRI');
      expect(() => check(header, [], 'hbcd')).toThrow(/MRI/);
    });
  });

  describe('the study-neutral column contract (spec §3.1)', () => {
    it('rejects a leftover ABCD.member header, pointing at Study.member', () => {
      const header = COLUMNS.map((c) => (c === 'Study.member' ? 'ABCD.member' : c));
      expect(() => check(header, [row()])).toThrow(/Study\.member/);
    });

    it('rejects a study whose domain taxonomy diverges, via the shared header check', () => {
      const header = COLUMNS.map((c) => (c === 'MRI' ? 'Neuroimaging' : c));
      expect(() => check(header, [row()], 'hbcd')).toThrow(/MRI/);
    });
  });
});
