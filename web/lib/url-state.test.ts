import { describe, expect, it } from 'vitest';
import { defaultFilter, maskOf, studyMaskOf } from './filter';
import { fromQuery, toQuery } from './url-state';

const BOUNDS = { yearMin: 2018, yearMax: 2026 };
const base = () => ({ filter: defaultFilter(BOUNDS), search: '' });

describe('toQuery', () => {
  it('is empty for the default view, so a clean URL stays clean', () => {
    expect(toQuery(base(), BOUNDS)).toBe('');
  });

  it('encodes only what differs from the default', () => {
    const q = new URLSearchParams(
      toQuery({ ...base(), filter: { ...base().filter, domains: maskOf(['MRI']) } }, BOUNDS),
    );
    expect(q.get('domains')).toBe('MRI');
    expect(q.get('years')).toBeNull();
    expect(q.get('member')).toBeNull();
  });
});

describe('fromQuery', () => {
  it('round-trips a fully populated state', () => {
    const state = {
      filter: {
        studies: studyMaskOf(['abcd']),
        domains: maskOf(['MRI', 'Genetics']),
        matchType: 'all' as const,
        members: { yes: true, no: false },
        yearMin: 2020,
        yearMax: 2024,
      },
      search: 'sleep AND "mood"',
    };
    expect(fromQuery(toQuery(state, BOUNDS), BOUNDS)).toEqual(state);
  });

  it('returns the default state for an empty query', () => {
    expect(fromQuery('', BOUNDS)).toEqual(base());
  });

  it('ignores a domain that no longer exists rather than breaking the page', () => {
    const state = fromQuery('domains=MRI,Astrology', BOUNDS);
    expect(state.filter.domains).toBe(maskOf(['MRI']));
  });

  it('clamps out-of-range and malformed years to the data bounds', () => {
    expect(fromQuery('years=1900-3000', BOUNDS).filter).toMatchObject({
      yearMin: 2018,
      yearMax: 2026,
    });
    expect(fromQuery('years=banana', BOUNDS).filter).toMatchObject({
      yearMin: 2018,
      yearMax: 2026,
    });
  });

  it('keeps an empty membership selection, which legitimately matches nothing', () => {
    expect(fromQuery('member=none', BOUNDS).filter.members).toEqual({ yes: false, no: false });
  });
});

describe('the study parameter (spec §4.1)', () => {
  const bounds = { yearMin: 2018, yearMax: 2026 };
  const base = { filter: defaultFilter(bounds), search: '' };

  it('omits studies at the default, keeping a clean URL', () => {
    expect(toQuery(base, bounds)).not.toContain('studies');
  });

  it('round-trips a single selected study', () => {
    const state = { ...base, filter: { ...base.filter, studies: studyMaskOf(['abcd']) } };
    const query = toQuery(state, bounds);
    expect(query).toContain('studies=abcd');
    expect(fromQuery(query, bounds).filter.studies).toBe(studyMaskOf(['abcd']));
  });

  it('round-trips a deselect-everything view', () => {
    const state = { ...base, filter: { ...base.filter, studies: 0 } };
    const query = toQuery(state, bounds);
    expect(query).toContain('studies=none');
    expect(fromQuery(query, bounds).filter.studies).toBe(0);
  });

  it('ignores an unknown study id rather than throwing', () => {
    expect(fromQuery('studies=abcd,mystery', bounds).filter.studies).toBe(studyMaskOf(['abcd']));
    expect(fromQuery('studies=mystery', bounds).filter.studies).toBe(0);
  });
});
