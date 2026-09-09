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
  it('adds an unselected key and removes a selected one', () => {
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
  it('maps selected keys back to row indexes in row order', () => {
    const sel = new Set([rowKey('abcd', 'https://doi.org/2'), rowKey('abcd', 'https://doi.org/0')]);
    expect(selectedRowIndexes(rows, sel)).toEqual([0, 2]);
  });

  it('survives selections whose rows are currently filtered out', () => {
    // Selection lives outside the filtered view, so a key that is not in the passed-in rows
    // simply contributes nothing rather than throwing.
    const sel = new Set([rowKey('abcd', 'https://doi.org/9')]);
    expect(selectedRowIndexes(rows, sel)).toEqual([]);
  });

  it('returns nothing for an empty selection', () => {
    expect(selectedRowIndexes(rows, new Set())).toEqual([]);
  });
});

describe('the composite row identity (spec §3.5)', () => {
  it('selects one study’s copy of a shared paper without selecting the other', () => {
    const shared = 'https://doi.org/10.1/shared';
    const both = [
      { ...(rows[0] as PubRow), i: 10, study: 'abcd', key: rowKey('abcd', shared), url: shared },
      { ...(rows[0] as PubRow), i: 11, study: 'hbcd', key: rowKey('hbcd', shared), url: shared },
    ] satisfies PubRow[];

    const selection = toggleSelection(new Set(), rowKey('hbcd', shared));
    expect(selectedRowIndexes(both, selection)).toEqual([11]);
  });

  it('keyed on URL alone, both copies would have been selected — this is the regression', () => {
    const shared = 'https://doi.org/10.1/shared';
    const both = [
      { ...(rows[0] as PubRow), i: 10, study: 'abcd', key: rowKey('abcd', shared), url: shared },
      { ...(rows[0] as PubRow), i: 11, study: 'hbcd', key: rowKey('hbcd', shared), url: shared },
    ] satisfies PubRow[];

    expect(both.filter((r) => r.url === shared)).toHaveLength(2);
    expect(new Set(both.map((r) => r.key)).size).toBe(2);
  });
});
