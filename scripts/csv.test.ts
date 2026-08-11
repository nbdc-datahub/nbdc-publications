import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple table', () => {
    const { header, rows } = parseCsv('a,b\n1,2\n3,4\n');
    expect(header).toEqual(['a', 'b']);
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    const { rows } = parseCsv('a,b\n"x,y",z\n');
    expect(rows).toEqual([['x,y', 'z']]);
  });

  it('unescapes doubled quotes', () => {
    const { rows } = parseCsv('a\n"he said ""hi"""\n');
    expect(rows).toEqual([['he said "hi"']]);
  });

  it('keeps newlines inside quoted fields (records span physical lines)', () => {
    const { rows } = parseCsv('a,b\n"line1\nline2",z\n');
    expect(rows).toEqual([['line1\nline2', 'z']]);
  });

  it('handles CRLF line endings and CRLF inside quotes', () => {
    const { header, rows } = parseCsv('a,b\r\n"x\r\ny",z\r\n');
    expect(header).toEqual(['a', 'b']);
    expect(rows).toEqual([['x\r\ny', 'z']]);
  });

  it('preserves empty fields', () => {
    const { rows } = parseCsv('a,b,c\n,x,\n');
    expect(rows).toEqual([['', 'x', '']]);
  });

  it('handles a final row with no trailing newline', () => {
    const { rows } = parseCsv('a\nlast');
    expect(rows).toEqual([['last']]);
  });

  it('strips a UTF-8 BOM', () => {
    const { header } = parseCsv('﻿a,b\n1,2\n');
    expect(header).toEqual(['a', 'b']);
  });

  it('keeps header names containing spaces, punctuation and #', () => {
    const { header } = parseCsv('"Friends, Family, & Community","# domains"\n1,2\n');
    expect(header).toEqual(['Friends, Family, & Community', '# domains']);
  });
});
