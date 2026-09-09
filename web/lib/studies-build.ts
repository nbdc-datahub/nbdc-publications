// Build-time read of the prep-generated studies.json (spec §3.2).
//
// SERVER ONLY — this uses node:fs and must never be imported from a client component.
// Reading at build time (rather than fetching in the browser) is what lets the study banner
// ship inside the static HTML: no extra request, no flash of a missing banner, and the
// per-study row counts are the same ones the deploy gate validated.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface StudySummary {
  id: string;
  label: string;
  name: string;
  rowCount: number;
  lastUpdated: string | null;
  hasDocumentation: boolean;
}

export function readStudySummaries(): StudySummary[] {
  const path = join(process.cwd(), 'public', 'data', 'studies.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    // Fail loudly: CI always runs prep before build (spec §8), so a missing file means the
    // gate was skipped — silently dropping the banner would hide that.
    throw new Error(`could not read ${path}. Run \`npm run prep\` before the build (spec §8).`, {
      cause,
    });
  }
  return JSON.parse(raw) as StudySummary[];
}

/** Studies that have no publications yet — what the banner announces (spec §4.5). */
export function studiesAwaitingData(summaries: readonly StudySummary[]): StudySummary[] {
  return summaries.filter((s) => s.rowCount === 0);
}

export function collectionNotice(pending: readonly StudySummary[]): string | null {
  if (pending.length === 0) return null;
  const labels = pending.map((s) => s.label);
  const joined =
    labels.length === 1
      ? (labels[0] as string)
      : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return labels.length === 1
    ? `${joined} data is still being collected — no ${joined} publications are listed yet.`
    : `${joined} data is still being collected — no publications from those studies are listed yet.`;
}
