'use client';

// Builds the react-plotly component over the PARTIAL bundle — export-safe and far smaller
// than full plotly.js. Loaded only via next/dynamic ssr:false (see ChartPanel).
import Plotly from 'plotly.js-basic-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

// biome-ignore lint/suspicious/noExplicitAny: the partial bundle is untyped; the factory accepts it.
const Plot = createPlotlyComponent(Plotly as any);

export default Plot;
