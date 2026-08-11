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

/** Keep "download as PNG"; drop the zoom/lasso clutter these charts do not need. */
export const PLOT_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: [
    'select2d',
    'lasso2d',
    'zoomIn2d',
    'zoomOut2d',
    'autoScale2d',
    'pan2d',
    'zoom2d',
  ],
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
      <h3 className="text-center text-base font-semibold">{title}</h3>
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
