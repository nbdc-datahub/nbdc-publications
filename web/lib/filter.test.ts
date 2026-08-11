import { describe, expect, it } from 'vitest';
import { DOMAINS, type PubRow } from './data';
import {
  defaultFilter,
  type FilterState,
  filterRows,
  isDefaultFilter,
  maskOf,
  searchRows,
} from './filter';

const bit = (name: (typeof DOMAINS)[number]) => 1 << DOMAINS.indexOf(name);
const MRI = bit('MRI');
const GEN = bit('Genetics');
const COVID = bit('COVID');

function row(over: Partial<PubRow> & Pick<PubRow, 'i'>): PubRow {
  return {
    year: 2020,
    title: `T${over.i}`,
    authors: 'A',
    journal: 'J',
    url: `u${over.i}`,
    member: 'yes',
    mask: 0,
    ...over,
  };
}

const ROWS: PubRow[] = [
  row({ i: 0, mask: MRI, year: 2018, member: 'yes' }),
  row({ i: 1, mask: MRI | GEN, year: 2020, member: 'no' }),
  row({ i: 2, mask: GEN, year: 2024, member: 'yes' }),
  row({ i: 3, mask: 0, year: 2026, member: 'no' }),
];

const BASE: FilterState = {
  domains: 0,
  matchType: 'any',
  members: { yes: true, no: true },
  yearMin: 2018,
  yearMax: 2026,
};

const ids = (rows: PubRow[]) => rows.map((r) => r.i);

describe('maskOf', () => {
  it('builds a bitmask from domain names', () => {
    expect(maskOf(['MRI'])).toBe(MRI);
    expect(maskOf(['MRI', 'Genetics'])).toBe(MRI | GEN);
    expect(maskOf([])).toBe(0);
  });
});

describe('filterRows — domains', () => {
  it('passes everything through when no domain is selected', () => {
    expect(ids(filterRows(ROWS, BASE))).toEqual([0, 1, 2, 3]);
  });

  it('ANY matches rows carrying at least one selected domain', () => {
    expect(ids(filterRows(ROWS, { ...BASE, domains: MRI | GEN, matchType: 'any' }))).toEqual([
      0, 1, 2,
    ]);
  });

  it('ALL matches only rows carrying every selected domain', () => {
    expect(ids(filterRows(ROWS, { ...BASE, domains: MRI | GEN, matchType: 'all' }))).toEqual([1]);
  });

  it('ANY and ALL agree when exactly one domain is selected', () => {
    const any = ids(filterRows(ROWS, { ...BASE, domains: MRI, matchType: 'any' }));
    const all = ids(filterRows(ROWS, { ...BASE, domains: MRI, matchType: 'all' }));
    expect(any).toEqual(all);
    expect(any).toEqual([0, 1]);
  });

  it('returns nothing for a domain no row carries', () => {
    expect(ids(filterRows(ROWS, { ...BASE, domains: COVID }))).toEqual([]);
  });
});

describe('filterRows — member', () => {
  it('keeps only the checked membership values', () => {
    expect(ids(filterRows(ROWS, { ...BASE, members: { yes: true, no: false } }))).toEqual([0, 2]);
    expect(ids(filterRows(ROWS, { ...BASE, members: { yes: false, no: true } }))).toEqual([1, 3]);
  });

  it('returns nothing when neither box is checked', () => {
    // Deliberate divergence from the Shiny app, which showed everything when the group was
    // empty. "No matching records" is the honest reading of "no membership value allowed".
    expect(ids(filterRows(ROWS, { ...BASE, members: { yes: false, no: false } }))).toEqual([]);
  });
});

describe('filterRows — years', () => {
  it('includes both boundary years', () => {
    expect(ids(filterRows(ROWS, { ...BASE, yearMin: 2018, yearMax: 2020 }))).toEqual([0, 1]);
    expect(ids(filterRows(ROWS, { ...BASE, yearMin: 2024, yearMax: 2026 }))).toEqual([2, 3]);
  });

  it('supports a single-year range', () => {
    expect(ids(filterRows(ROWS, { ...BASE, yearMin: 2020, yearMax: 2020 }))).toEqual([1]);
  });
});

describe('filterRows — combined', () => {
  it('applies domain, member and year together', () => {
    expect(
      ids(
        filterRows(ROWS, {
          ...BASE,
          domains: MRI | GEN,
          matchType: 'any',
          members: { yes: true, no: false },
          yearMin: 2019,
          yearMax: 2026,
        }),
      ),
    ).toEqual([2]);
  });
});

describe('searchRows', () => {
  const searchable: PubRow[] = [
    row({ i: 0, title: 'Sleep and adolescent brains', authors: 'Chen, L', journal: 'Nature' }),
    row({ i: 1, title: 'Screen time', authors: 'Sleep, A', journal: 'JAMA', year: 2019 }),
    row({ i: 2, title: 'Unrelated', authors: 'Other', journal: 'Cell' }),
  ];

  it('returns every row for an empty or whitespace query', () => {
    expect(ids(searchRows(searchable, ''))).toEqual([0, 1, 2]);
    expect(ids(searchRows(searchable, '   '))).toEqual([0, 1, 2]);
  });

  it('matches case-insensitively across title, authors, journal and year', () => {
    expect(ids(searchRows(searchable, 'SLEEP'))).toEqual([0, 1]);
    expect(ids(searchRows(searchable, 'jama'))).toEqual([1]);
    expect(ids(searchRows(searchable, '2019'))).toEqual([1]);
  });

  it('requires every term to match (AND), not just one', () => {
    expect(ids(searchRows(searchable, 'sleep nature'))).toEqual([0]);
    expect(ids(searchRows(searchable, 'sleep cell'))).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...searchable];
    searchRows(input, 'sleep');
    expect(input).toHaveLength(3);
  });
});

describe('defaultFilter / isDefaultFilter', () => {
  const index = { yearMin: 2018, yearMax: 2026 };

  it('defaults to the data’s own year bounds and both membership values', () => {
    expect(defaultFilter(index)).toEqual(BASE);
  });

  it('detects a modified filter', () => {
    expect(isDefaultFilter(defaultFilter(index), index)).toBe(true);
    expect(isDefaultFilter({ ...defaultFilter(index), domains: MRI }, index)).toBe(false);
    expect(isDefaultFilter({ ...defaultFilter(index), yearMin: 2019 }, index)).toBe(false);
    expect(isDefaultFilter({ ...defaultFilter(index), matchType: 'all' }, index)).toBe(false);
  });
});
