'use client';

import { DOMAINS, type PubRow } from '../lib/data';
import { domainCounts } from '../lib/filter';
import { hidePlotGraphicsFromAt } from '../lib/plot-a11y';
import { useChartColors } from '../lib/use-chart-colors';
import { ChartCard, PLOT_CONFIG, Plot } from './ChartCard';

export function DomainChart({
  rows,
  selectedMask,
}: {
  rows: readonly PubRow[];
  selectedMask: number;
}) {
  const colors = useChartColors();
  const counts = domainCounts(rows);

  // Only domains actually present, smallest first — Plotly draws the first category at the
  // bottom, so ascending here puts the largest bar on top (as in the Shiny app).
  const present = DOMAINS.map((name, bit) => ({ name, bit, count: counts[bit] as number }))
    .filter((d) => d.count > 0)
    .sort((a, b) => a.count - b.count);

  const anySelected = selectedMask !== 0;
  const isSelected = (bit: number) => !anySelected || ((selectedMask >> bit) & 1) === 1;
  const max = Math.max(1, ...present.map((d) => d.count));

  const summary = present.length
    ? `Publications by research domain: ${[...present]
        .reverse()
        .map(
          (d) =>
            `${d.name}, ${d.count}${anySelected && !isSelected(d.bit) ? ' (not selected)' : ''}`,
        )
        .join('; ')}. Categories are not mutually exclusive.`
    : 'No publications match the current filters.';

  return (
    <ChartCard
      title="Publications by Research Domain"
      subtitle="Categories are not mutually exclusive"
      summary={summary}
      empty={present.length === 0}
    >
      <Plot
        data={[
          {
            type: 'bar',
            orientation: 'h',
            x: present.map((d) => d.count),
            y: present.map((d) => d.name),
            text: present.map((d) => String(d.count)),
            textposition: 'outside',
            cliponaxis: false,
            hovertemplate: '%{y}: %{x} publications<extra></extra>',
            marker: {
              color: present.map((d) => (isSelected(d.bit) ? colors.accent : colors.unselected)),
              // Hatching, not just colour, marks the domains excluded by the filter — so the
              // distinction survives greyscale printing and colour-vision deficiency.
              pattern: {
                shape: present.map((d) => (isSelected(d.bit) ? '' : '/')),
                fgcolor: colors.muted,
                size: 6,
                solidity: 0.35,
              },
            },
          },
        ]}
        layout={{
          height: 400,
          // t leaves a band for the always-visible mode bar so it never covers a bar.
          margin: { l: 170, r: 44, t: 34, b: 40 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: colors.foreground, size: 13 },
          xaxis: {
            title: { text: 'Number of Publications' },
            range: [0, max * 1.12],
            gridcolor: colors.grid,
            zerolinecolor: colors.grid,
          },
          yaxis: { automargin: true, tickfont: { color: colors.foreground } },
          bargap: 0.28,
          showlegend: false,
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
