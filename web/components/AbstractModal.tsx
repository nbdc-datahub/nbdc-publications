'use client';

import { useEffect, useRef } from 'react';

export interface AbstractView {
  title: string;
  url: string;
  status: 'loading' | 'ready' | 'error';
  text: string;
}

/**
 * Native <dialog> so focus trapping, Escape-to-close and focus restoration are the platform's
 * job rather than ours (spec §4.3).
 */
export function AbstractModal({
  view,
  onClose,
}: {
  view: AbstractView | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (view && !dialog.open) dialog.showModal();
    if (!view && dialog.open) dialog.close();
  }, [view]);

  return (
    // The click handler only implements backdrop dismissal, a pointer-only affordance.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is the keyboard equivalent and <dialog> handles it natively, firing onClose.
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop lands on the dialog element itself, not its content.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="glass-card m-auto max-h-[80vh] w-[min(46rem,92vw)] rounded-xl p-0 text-foreground backdrop:bg-black/50"
    >
      {view ? (
        <div className="flex max-h-[80vh] flex-col">
          <header className="border-b border-border px-5 py-4">
            <h2 className="pr-6 text-base font-semibold">{view.title}</h2>
          </header>

          <div className="overflow-y-auto px-5 py-4 text-sm leading-relaxed">
            {view.status === 'loading' ? (
              <p className="text-muted">
                Loading abstract
                <span className="dot-pulse" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            ) : null}
            {view.status === 'error' ? (
              <p role="alert" className="text-muted">
                That abstract could not be loaded. Check your connection and try again.
              </p>
            ) : null}
            {view.status === 'ready' ? (
              <p className="whitespace-pre-wrap">
                {view.text || 'No abstract is available for this publication.'}
              </p>
            ) : null}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <a
              href={view.url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring text-sm text-link underline underline-offset-2"
            >
              Open publication ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring btn-ghost rounded-md px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
