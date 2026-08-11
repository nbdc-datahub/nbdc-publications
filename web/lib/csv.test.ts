import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/csv';
import { csvField, toCsv } from './csv';

describe('csvField', () => {
  it('leaves plain values unquoted', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('')).toBe('');
  });

  it('quotes values containing a comma, quote, CR or LF', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField('a\rb')).toBe('"a\rb"');
  });
});

describe('toCsv', () => {
  it('round-trips every hostile field through the parser', () => {
    const header = ['plain', 'comma', 'quote', 'newline', 'crlf', 'empty'];
    const rows = [
      ['x', 'a,b', 'say "hi"', 'line1\nline2', 'line1\r\nline2', ''],
      ['', '", "', '""', '\n', '\r', 'z'],
    ];
    const parsed = parseCsv(toCsv(header, rows));
    expect(parsed.header).toEqual(header);
    expect(parsed.rows).toEqual(rows);
  });

  it('ends with a trailing newline', () => {
    expect(toCsv(['a'], [['1']])).toBe('a\n1\n');
  });
});
