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
    'ABCD.member': 'yes',
    MRI: '1',
    ...over,
  };
  return COLUMNS.map((c) => filled[c] as string);
}

/** Builds a CSV, parses it back, and validates — the exact path prep.ts takes. */
function check(header: string[], rows: string[][]) {
  const parsed = parseCsv(toCsv(header, rows));
  return validateRecords(parsed.header, parsed.rows);
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

  it('rejects an ABCD.member value outside {yes,no}, naming the column', () => {
    expect(() => check([...COLUMNS], [row({ 'ABCD.member': 'Yes' })])).toThrow(/ABCD\.member/);
  });

  it('rejects a non-integer publication year, naming the column', () => {
    expect(() => check([...COLUMNS], [row({ 'Pub.Year': '20xx' })])).toThrow(/Pub\.Year/);
  });

  it('rejects a domain flag outside {0,1}, naming the domain column', () => {
    expect(() => check([...COLUMNS], [row({ MRI: '2' })])).toThrow(/MRI/);
  });

  it('rejects an empty table', () => {
    expect(() => check([...COLUMNS], [])).toThrow(/no rows/i);
  });

  it('rejects duplicate URLs, naming the column and the offending value', () => {
    expect(() => check([...COLUMNS], [row(), row()])).toThrow(/URL/);
  });

  it('rejects a row with the wrong number of fields', () => {
    expect(() => check([...COLUMNS], [row().slice(0, 45)])).toThrow(ValidationError);
  });
});
