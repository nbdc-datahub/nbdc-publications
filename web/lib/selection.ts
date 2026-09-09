// Row selection (spec §4.3). Keyed by `<study>:<URL>` rather than by row position so a
// selection survives filtering, searching, sorting and pagination.
//
// Why the study is part of the key: URL is unique only WITHIN a study (scripts/validate.ts).
// A publication that uses two studies' data appears in both files, and keyed on URL alone
// those two rows would share one selection entry — checking either would silently select
// both, and "Download Selected Rows" would over-export (spec §3.5).

import type { PubRow } from './data';

export type Selection = ReadonlySet<string>;

export function toggleSelection(selection: Selection, key: string): Set<string> {
  const next = new Set(selection);
  if (!next.delete(key)) next.add(key);
  return next;
}

/** Row indexes for the selected keys, in row order (so exports keep source ordering). */
export function selectedRowIndexes(rows: readonly PubRow[], selection: Selection): number[] {
  if (selection.size === 0) return [];
  return rows.filter((r) => selection.has(r.key)).map((r) => r.i);
}
