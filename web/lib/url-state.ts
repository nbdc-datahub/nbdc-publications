// Shareable filter permalinks (Plans 6.1). Human-readable on purpose — a pasted URL should
// be legible: ?studies=abcd&domains=MRI,Genetics&match=all&years=2020-2024

import { DOMAINS, STUDY_IDS } from './data';
import {
  defaultFilter,
  type FilterState,
  maskOf,
  namesOf,
  studyMaskOf,
  studyNamesOf,
  type YearBounds,
} from './filter';

export interface UiState {
  filter: FilterState;
  search: string;
}

const DOMAIN_SET: ReadonlySet<string> = new Set(DOMAINS);
const STUDY_SET: ReadonlySet<string> = new Set(STUDY_IDS);

export function toQuery(state: UiState, bounds: YearBounds): string {
  const d = defaultFilter(bounds);
  const params = new URLSearchParams();
  const { filter, search } = state;

  // "none" rather than an empty value, so a deselect-everything view survives a round-trip.
  if (filter.studies !== d.studies) {
    params.set('studies', studyNamesOf(filter.studies).join(',') || 'none');
  }
  if (filter.domains !== d.domains) params.set('domains', namesOf(filter.domains).join(','));
  if (filter.matchType !== d.matchType) params.set('match', filter.matchType);
  if (filter.members.yes !== d.members.yes || filter.members.no !== d.members.no) {
    const picked = [filter.members.yes && 'yes', filter.members.no && 'no'].filter(
      Boolean,
    ) as string[];
    params.set('member', picked.length ? picked.join(',') : 'none');
  }
  if (filter.yearMin !== d.yearMin || filter.yearMax !== d.yearMax) {
    params.set('years', `${filter.yearMin}-${filter.yearMax}`);
  }
  if (search) params.set('q', search);

  return params.toString();
}

function clampYears(raw: string | null, bounds: YearBounds): { yearMin: number; yearMax: number } {
  const match = raw?.match(/^(\d{4})-(\d{4})$/);
  if (!match) return { yearMin: bounds.yearMin, yearMax: bounds.yearMax };
  const clamp = (n: number) => Math.min(Math.max(n, bounds.yearMin), bounds.yearMax);
  const lo = clamp(Number(match[1]));
  const hi = clamp(Number(match[2]));
  return { yearMin: Math.min(lo, hi), yearMax: Math.max(lo, hi) };
}

export function fromQuery(query: string, bounds: YearBounds): UiState {
  const params = new URLSearchParams(query);
  const filter = defaultFilter(bounds);

  const studies = params.get('studies');
  if (studies !== null) {
    filter.studies = studyMaskOf(studies.split(',').filter((id) => STUDY_SET.has(id)));
  }

  const domains = params.get('domains');
  if (domains !== null) {
    filter.domains = maskOf(domains.split(',').filter((name) => DOMAIN_SET.has(name)));
  }

  if (params.get('match') === 'all') filter.matchType = 'all';

  const member = params.get('member');
  if (member !== null) {
    const picked = member.split(',');
    filter.members = { yes: picked.includes('yes'), no: picked.includes('no') };
  }

  Object.assign(filter, clampYears(params.get('years'), bounds));

  return { filter, search: params.get('q') ?? '' };
}
