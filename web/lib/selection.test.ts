import { describe, expect, it } from 'vitest';
import { type PubRow, rowKey } from './data';
import { selectedRowIndexes, toggleSelection } from './selection';

const rows = [0, 1, 2, 3].map(
  (i) =>
    ({
      i,
      study: 'abcd',
      key: rowKey('abcd', `https://doi.org/${i}`),
      year: 2020,
      title: `T${i}`,
      authors: 'A',
      journal: 'J',
      url: `https://doi.org/${i}`,
      member: 'yes',
      mask: 0,
    }) satisfies PubRow,
);

describe('toggleSelection', () => {
  it('adds an unselected url and removes a selected one', () => {
    const a = toggleSelection(new Set(), 'x');
    expect([...a]).toEqual(['x']);
    expect([...toggleSelection(a, 'x')]).toEqual([]);
  });

  it('does not mutate the previous set (React state stays immutable)', () => {
    const before = new Set(['x']);
    const after = toggleSelection(before, 'y');
    expect([...before]).toEqual(['x']);
    expect(after.size).toBe(2);
  });
});

describe('selectedRowIndexes', () => {
  it('maps selected urls back to row indexes in row order', () => {
    const sel = new Set(['https://doi.org/2', 'https://doi.org/0']);
    expect(selectedRowIndexes(rows, sel)).toEqual([0, 2]);
  });

  it('survives selections whose rows are currently filtered out', () => {
    // Selection is keyed by URL and lives outside the filtered view, so a url that is not
    // in the passed-in rows simply contributes nothing rather than throwing.
    const sel = new Set(['https://doi.org/9']);
    expect(selectedRowIndexes(rows, sel)).toEqual([]);
  });

  it('returns nothing for an empty selection', () => {
    expect(selectedRowIndexes(rows, new Set())).toEqual([]);
  });
});
