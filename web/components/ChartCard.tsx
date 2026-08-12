'use client';

import dynamic from 'next/dynamic';
import type { Config, Layout } from 'plotly.js';
import type { ChartColors } from '../lib/use-chart-colors';

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

// The mode bar appears on hover (Plotly's own default): PNG download, zoom and autoscale are
// useful, but not worth permanent visual weight on a page whose charts are read at a glance.
// Selection tools are dropped — nothing consumes a selected set of bars.
// Charts keep a top margin so the bar, when it appears, never covers a value label.
export const PLOT_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  displayModeBar: 'hover',
  modeBarButtonsToRemove: ['select2d', 'lasso2d'],
};

/**
 * Mode-bar colours, driven by the theme tokens. Plotly's default icon colour is a hard-coded
 * dark grey (#444) that all but disappears on the dark card, so both charts set this
 * explicitly; it re-renders with the palette when the theme changes.
 */
export function MODEBAR_STYLE(colors: ChartColors): Partial<Layout>['modebar'] {
  return {
    bgcolor: 'rgba(0,0,0,0)',
    color: colors.muted,
    activecolor: colors.accent,
  };
}

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
          {children}
        </>
      )}
    </section>
  );
}
