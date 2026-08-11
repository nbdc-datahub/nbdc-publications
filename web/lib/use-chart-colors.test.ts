import { afterEach, describe, expect, it, vi } from 'vitest';
import { readChartTokens, sameColors, subscribeToThemeChange } from './use-chart-colors';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('readChartTokens', () => {
  it('reads the CSS custom properties currently in effect', () => {
    document.documentElement.style.setProperty('--foreground', '#0b0c0f');
    document.documentElement.style.setProperty('--accent', '#6366f1');
    const colors = readChartTokens(document.documentElement);
    expect(colors.foreground).toBe('#0b0c0f');
    expect(colors.accent).toBe('#6366f1');
  });

  it('falls back to readable defaults when a token is undefined', () => {
    const colors = readChartTokens(document.documentElement);
    expect(colors.foreground).toBeTruthy();
    expect(colors.grid).toBeTruthy();
  });
});

describe('sameColors', () => {
  it('avoids a re-render when nothing changed', () => {
    const a = readChartTokens(document.documentElement);
    expect(sameColors(a, { ...a })).toBe(true);
    expect(sameColors(a, { ...a, accent: '#000000' })).toBe(false);
  });
});

describe('subscribeToThemeChange', () => {
  it('fires when the <html> class changes', async () => {
    // Regression guard: keying the chart palette off next-themes' resolvedTheme left charts
    // one theme behind, because child effects run before the provider applies the class.
    const onChange = vi.fn();
    cleanups.push(subscribeToThemeChange(onChange));

    document.documentElement.className = 'dark';
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).toHaveBeenCalled();
  });

  it('stops firing once unsubscribed', async () => {
    const onChange = vi.fn();
    subscribeToThemeChange(onChange)();

    document.documentElement.className = 'dark';
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).not.toHaveBeenCalled();
  });
});
