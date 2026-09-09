import { collectionNotice, readStudySummaries, studiesAwaitingData } from '../lib/studies-build';

/**
 * A small note under the navbar for any study still collecting data (spec §4.5).
 *
 * Data-driven on purpose: it is keyed on `rowCount === 0`, so it disappears by itself the
 * first time a study publishes — nobody has to remember to delete it. Informational rather
 * than an alert, non-sticky so it scrolls away, and hidden in print.
 */
export function StudyBanner() {
  const notice = collectionNotice(studiesAwaitingData(readStudySummaries()));
  if (notice === null) return null;

  return (
    <div className="no-print border-b border-border bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]">
      <p className="mx-auto flex max-w-[108rem] items-center gap-2 px-4 py-2 text-xs text-muted">
        <span aria-hidden>ℹ️</span>
        {notice}
      </p>
    </div>
  );
}
