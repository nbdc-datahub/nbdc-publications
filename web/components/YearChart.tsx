'use client';

import type { PubRow } from '../lib/data';
import { yearCounts } from '../lib/filter';
import { hidePlotGraphicsFromAt } from '../lib/plot-a11y';
import { useChartColors } from '../lib/use-chart-colors';
import { ChartCard, PLOT_CONFIG, Plot } from './ChartCard';

export function YearChart({ rows }: { rows: readonly PubRow[] }) {
  const colors = useChartColors();
  const counts = yearCounts(rows);
  const years = counts.map((c) => String(c.year));
  const max = Math.max(1, ...counts.map((c) => c.total));

  const summary = counts.length
    ? `Publications by year: ${counts
        .map(
          (c) =>
            `${c.year}, ${c.total} total (${c.yes} with an ABCD member author, ${c.no} without)`,
        )
        .join('; ')}.`
    : 'No publications match the current filters.';

  const segment = (key: 'yes' | 'no', name: string, color: string, pattern: string) => ({
    type: 'bar' as const,
    name,
    x: years,
    y: counts.map((c) => c[key]),
    text: counts.map((c) => (c[key] > 0 ? String(c[key]) : '')),
    textposition: 'inside' as const,
    insidetextanchor: 'middle' as const,
    hovertemplate: `%{x}: %{y} ${name}<extra></extra>`,
    marker: {
      color,
      pattern: { shape: pattern, fgcolor: colors.muted, size: 6, solidity: 0.3 },
    },
  });

  return (
    <ChartCard title="Publications by Year" summary={summary} empty={counts.length === 0}>
      <Plot
        data={[
          segment('yes', 'ABCD member author', colors.accent, ''),
          segment('no', 'No ABCD member author', colors.unselected, '/'),
        ]}
        layout={{
          height: 400,
          barmode: 'stack',
          // t leaves a band for the always-visible mode bar so it never covers a bar total.
          margin: { l: 56, r: 16, t: 34, b: 44 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: colors.foreground, size: 13 },
          xaxis: { title: { text: 'Publication Year' }, type: 'category' },
          yaxis: {
            title: { text: 'Number of Publications' },
            range: [0, max * 1.16],
            gridcolor: colors.grid,
            zerolinecolor: colors.grid,
          },
          // The bold per-year total sits above each stacked bar. On a category axis an
          // annotation's x is a category INDEX, not the label — passing "2018" is read as the
          // number 2018 and stretches the axis until every bar collapses into a sliver.
          annotations: counts.map((c, i) => ({
            x: i,
            y: c.total,
            text: `<b>${c.total}</b>`,
            showarrow: false,
            yshift: 12,
            font: { color: colors.foreground, size: 13 },
          })),
          legend: { orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center' },
        }}
        config={PLOT_CONFIG}
        style={{ width: '100%', height: '400px' }}
        useResizeHandler
        onInitialized={(_figure, graphDiv) => hidePlotGraphicsFromAt(graphDiv)}
        onUpdate={(_figure, graphDiv) => hidePlotGraphicsFromAt(graphDiv)}
      />
    </ChartCard>
  );
}
