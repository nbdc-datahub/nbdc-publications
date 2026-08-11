'use client';

// Plotly cannot read CSS variables, so charts pull the resolved token values out of the
// document and re-read them whenever the theme changes (spec §5: legible in both themes).
//
// This deliberately watches the <html> class attribute rather than next-themes' resolvedTheme.
// next-themes applies the class from a provider-level effect, and React runs child effects
// BEFORE ancestor ones — so a hook keyed on resolvedTheme reads the *previous* theme's tokens
// and leaves the chart one theme behind (light text on a light background).

import { useEffect, useState } from 'react';

export interface ChartColors {
  accent: string;
  accent2: string;
  unselected: string;
  foreground: string;
  muted: string;
  grid: string;
}

const FALLBACK: ChartColors = {
  accent: '#6366f1',
  accent2: '#8b5cf6',
  unselected: '#cbd5e1',
  foreground: '#0b0c0f',
  muted: '#64748b',
  grid: '#e2e8f0',
};

const TOKENS: Record<keyof ChartColors, string> = {
  accent: '--accent',
  accent2: '--accent-2',
  unselected: '--chart-unselected',
  foreground: '--foreground',
  muted: '--muted',
  grid: '--chart-grid',
};

export function readChartTokens(root: HTMLElement): ChartColors {
  const style = getComputedStyle(root);
  const out = {} as ChartColors;
  for (const key of Object.keys(TOKENS) as (keyof ChartColors)[]) {
    out[key] = style.getPropertyValue(TOKENS[key]).trim() || FALLBACK[key];
  }
  return out;
}

export function sameColors(a: ChartColors, b: ChartColors): boolean {
  return (Object.keys(TOKENS) as (keyof ChartColors)[]).every((k) => a[k] === b[k]);
}

/** Fires whenever the resolved theme could have changed. Returns an unsubscribe function. */
export function subscribeToThemeChange(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  // "system" theme sets no class, so follow the OS preference directly too.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    const sync = () => {
      const next = readChartTokens(document.documentElement);
      setColors((current) => (sameColors(current, next) ? current : next));
    };
    sync();
    return subscribeToThemeChange(sync);
  }, []);

  return colors;
}
