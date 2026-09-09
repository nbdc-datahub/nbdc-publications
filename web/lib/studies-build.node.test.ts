import { describe, expect, it } from 'vitest';
import { collectionNotice, type StudySummary, studiesAwaitingData } from './studies-build';

const study = (over: Partial<StudySummary>): StudySummary => ({
  id: 'abcd',
  label: 'ABCD',
  name: 'Adolescent Brain Cognitive Development (ABCD) Study',
  rowCount: 1848,
  lastUpdated: '2026-07-06',
  ...over,
});

const ABCD = study({});
const HBCD = study({
  id: 'hbcd',
  label: 'HBCD',
  name: 'HBCD Study',
  rowCount: 0,
  lastUpdated: null,
});

describe('studiesAwaitingData', () => {
  it('picks out only the studies with no publications', () => {
    expect(studiesAwaitingData([ABCD, HBCD])).toEqual([HBCD]);
  });

  it('finds none once every study has published', () => {
    expect(studiesAwaitingData([ABCD, { ...HBCD, rowCount: 3 }])).toEqual([]);
  });
});

describe('collectionNotice (spec §4.5)', () => {
  it('names the study that is still collecting', () => {
    const notice = collectionNotice([HBCD]);
    expect(notice).toContain('HBCD');
    expect(notice).toMatch(/still being collected/);
  });

  it('renders nothing once the study has data — the banner removes itself', () => {
    expect(collectionNotice(studiesAwaitingData([ABCD, { ...HBCD, rowCount: 1 }]))).toBeNull();
  });

  it('reads correctly with more than one pending study', () => {
    const third = study({ id: 'x', label: 'XYZ', rowCount: 0 });
    expect(collectionNotice([HBCD, third])).toContain('HBCD and XYZ');
  });
});
