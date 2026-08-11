// Row selection (spec §4.3). Keyed by URL rather than by row position so a selection
// survives filtering, searching, sorting and pagination — the data pipeline guarantees URL
// is unique (scripts/validate.ts), which is what makes it usable as an identity.

import type { PubRow } from './data';

export type Selection = ReadonlySet<string>;

export function toggleSelection(selection: Selection, url: string): Set<string> {
  const next = new Set(selection);
  if (!next.delete(url)) next.add(url);
  return next;
}

/** Row indexes for the selected URLs, in row order (so exports keep source ordering). */
export function selectedRowIndexes(rows: readonly PubRow[], selection: Selection): number[] {
  if (selection.size === 0) return [];
  return rows.filter((r) => selection.has(r.url)).map((r) => r.i);
}
