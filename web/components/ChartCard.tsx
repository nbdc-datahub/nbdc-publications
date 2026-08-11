'use client';

import dynamic from 'next/dynamic';

/** Plotly touches `window` at import time, so it can only load in the browser. */
export const Plot = dynamic(() => import('./PlotlyChart'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center text-sm text-muted">
      <span className="dot-pulse" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">Loading chart</span>
    </div>
  ),
});

import type { Config } from 'plotly.js';

// The mode bar is off entirely. Its buttons are focusable, and the plot subtree is marked
// aria-hidden (the text summary below is the accessible version) — a focusable element inside
// aria-hidden is a keyboard trap for screen-reader users. The charts need no zoom or pan, and
// the underlying numbers are downloadable as CSV.
export const PLOT_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  displayModeBar: false,
};

export function ChartCard({
  title,
  subtitle,
  summary,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Text alternative for the chart — the only version a screen reader gets. */
  summary: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-xl p-5" aria-label={title}>
      {/* h2, not h3: the page's only h1 is the site title, so a chart heading at h3 would
          skip a level. */}
      <h2 className="text-center text-base font-semibold">{title}</h2>
      {subtitle ? <p className="text-center text-xs text-muted">{subtitle}</p> : null}
      {empty ? (
        <p className="flex h-[400px] items-center justify-center text-sm text-muted">
          No matching records found.
        </p>
      ) : (
        <>
          <p className="sr-only">{summary}</p>
          <div aria-hidden>{children}</div>
        </>
      )}
    </section>
  );
}
