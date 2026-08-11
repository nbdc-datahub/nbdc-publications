'use client';

import { useState } from 'react';
import type { AbstractStore } from '../lib/abstracts';
import type { PubIndex, PubRow } from '../lib/data';
import {
  buildCsv,
  DOCUMENTATION_PATH,
  downloadCsv,
  type ExportKind,
  exportFileName,
  todayStamp,
  UNFILTERED_PATH,
} from '../lib/export';
import type { Selection } from '../lib/selection';
import { selectedRowIndexes } from '../lib/selection';

export function DownloadPanel({
  index,
  abstracts,
  filtered,
  searched,
  selection,
  onClearSelection,
}: {
  index: PubIndex;
  abstracts: AbstractStore;
  filtered: readonly PubRow[];
  searched: readonly PubRow[];
  selection: Selection;
  onClearSelection: () => void;
}) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every export except the prebuilt full file includes the Abstract column, so it needs the
  // shards that first load deliberately skipped. Fetched once, then cached (spec §4.4).
  const run = async (kind: ExportKind, rowIndexes: number[]) => {
    setBusy(kind);
    setError(null);
    try {
      const all = await abstracts.all();
      downloadCsv(
        exportFileName(kind, todayStamp(), index.lastUpdated),
        buildCsv(index, rowIndexes, all),
      );
    } catch {
      setError('Could not prepare the download. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const selectedCount = selection.size;
  const label = (kind: ExportKind, text: string) =>
    busy === kind ? (
      <>
        Preparing
        <span className="dot-pulse" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </>
    ) : (
      text
    );

  return (
    <div className="no-print space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="focus-ring btn-primary rounded-lg px-3 py-2 text-sm"
          disabled={busy !== null}
          onClick={() =>
            run(
              'filtered',
              filtered.map((r) => r.i),
            )
          }
        >
          {label('filtered', `Download Filtered Data (${filtered.length.toLocaleString()})`)}
        </button>

        <button
          type="button"
          className="focus-ring btn-ghost rounded-lg px-3 py-2 text-sm"
          disabled={busy !== null}
          onClick={() =>
            run(
              'search',
              searched.map((r) => r.i),
            )
          }
        >
          {label('search', `Download Search Results (${searched.length.toLocaleString()})`)}
        </button>

        {selectedCount > 0 ? (
          <button
            type="button"
            className="focus-ring btn-ghost rounded-lg px-3 py-2 text-sm"
            disabled={busy !== null}
            onClick={() => run('selected', selectedRowIndexes(filtered, selection))}
          >
            {label('selected', `Download Selected Rows (${selectedCount.toLocaleString()})`)}
          </button>
        ) : null}

        {/* A plain link to the prebuilt file — no JS, no shard fetches. */}
        <a
          href={UNFILTERED_PATH(index.lastUpdated)}
          download
          className="focus-ring btn-ghost rounded-lg px-3 py-2 text-sm"
        >
          Download Unfiltered Data ({index.rowCount.toLocaleString()})
        </a>

        <a
          href={DOCUMENTATION_PATH}
          download
          className="focus-ring btn-ghost rounded-lg px-3 py-2 text-sm"
        >
          Download Documentation (PDF)
        </a>
      </div>

      <p className="text-xs text-muted">
        Exports include bibliometrics, Altmetrics and all {index.columns.length} source columns; see
        the documentation PDF.
      </p>

      {selectedCount > 0 ? (
        <p className="text-sm" aria-live="polite">
          {selectedCount.toLocaleString()} row{selectedCount === 1 ? '' : 's'} selected{' '}
          <button
            type="button"
            className="focus-ring text-accent underline underline-offset-2"
            onClick={onClearSelection}
          >
            Clear selections
          </button>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-muted">
          {error}
        </p>
      ) : null}
    </div>
  );
}
