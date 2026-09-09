// CSV exports (spec §4.4). Filenames match the Shiny app so existing downstream scripts
// keep working. CSV only — Excel opens it, and dropping XLSX keeps ~400 KB of JS off the page.

import { withBasePath } from './base-path';
import { toCsv } from './csv';
import { buildExportRows, EXPORT_COLUMNS, type PubIndex } from './data';

export type ExportKind = 'filtered' | 'unfiltered' | 'search' | 'selected';

export function exportFileName(kind: ExportKind, today: string, lastUpdated: string): string {
  // The full export is named by the data snapshot; subsets by the day they were taken.
  const stamp = kind === 'unfiltered' ? lastUpdated : today;
  return `abcd-pubs_${kind}_${stamp}.csv`;
}

/** The prebuilt full export — a plain link, no client-side work and no shard fetches. */
export function UNFILTERED_PATH(lastUpdated: string): string {
  return withBasePath(`/downloads/${exportFileName('unfiltered', '', lastUpdated)}`);
}

export const DOCUMENTATION_PATH = withBasePath('/downloads/abcd-pubs_data-document.pdf');

export function todayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function buildCsv(
  index: PubIndex,
  rowIndexes: readonly number[],
  abstracts: readonly (string | undefined)[],
): string {
  return toCsv(EXPORT_COLUMNS, buildExportRows(index, rowIndexes, abstracts));
}

/** Hands the browser a generated file. No-op outside a DOM. */
export function downloadCsv(fileName: string, csv: string): void {
  if (typeof document === 'undefined') return;
  // Excel needs a BOM to read UTF-8 accented author names correctly.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
