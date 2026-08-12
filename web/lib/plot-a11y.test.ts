import { describe, expect, it } from 'vitest';
import { hidePlotGraphicsFromAt } from './plot-a11y';

/** Reproduces Plotly's real DOM: the mode bar is a CHILD of .svg-container, not a sibling. */
function plotDiv(): HTMLElement {
  const gd = document.createElement('div');
  gd.className = 'js-plotly-plot';
  gd.innerHTML = `
    <div class="plot-container plotly">
      <div class="user-select-none svg-container">
        <svg class="main-svg"></svg>
        <div class="gl-container"></div>
        <svg class="main-svg"></svg>
        <div class="modebar-container">
          <div class="modebar">
            <a class="modebar-btn" data-title="Download plot as a png"></a>
            <a class="modebar-btn" data-title="Zoom in" aria-label="Existing label"></a>
            <a class="modebar-btn"></a>
          </div>
        </div>
        <svg class="main-svg"></svg>
      </div>
    </div>`;
  return gd;
}

describe('hidePlotGraphicsFromAt', () => {
  it('hides every graphics sibling from assistive tech', () => {
    const gd = plotDiv();
    hidePlotGraphicsFromAt(gd);
    for (const svg of gd.querySelectorAll('svg.main-svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    expect(gd.querySelector('.gl-container')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves the mode bar exposed — its buttons are focusable and must stay announced', () => {
    // Regression guard: hiding the whole plot wrapper buried real controls inside an
    // aria-hidden subtree, which is a keyboard trap (axe aria-hidden-focus).
    const gd = plotDiv();
    hidePlotGraphicsFromAt(gd);
    const modebar = gd.querySelector('.modebar-container');
    expect(modebar?.hasAttribute('aria-hidden')).toBe(false);
    expect(modebar?.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('clears a stale aria-hidden left on the mode bar by an earlier render', () => {
    const gd = plotDiv();
    gd.querySelector('.modebar-container')?.setAttribute('aria-hidden', 'true');
    hidePlotGraphicsFromAt(gd);
    expect(gd.querySelector('.modebar-container')?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('names mode-bar buttons from their tooltip, without overwriting an existing name', () => {
    const gd = plotDiv();
    hidePlotGraphicsFromAt(gd);
    const buttons = [...gd.querySelectorAll('.modebar-btn')];
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Download plot as a png');
    expect(buttons[1]?.getAttribute('aria-label')).toBe('Existing label');
    expect(buttons[2]?.getAttribute('aria-label')).toBeNull();
  });

  it('is idempotent across re-renders', () => {
    const gd = plotDiv();
    hidePlotGraphicsFromAt(gd);
    hidePlotGraphicsFromAt(gd);
    expect(gd.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
    expect(gd.querySelector('.modebar-container')?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('does nothing when Plotly has not rendered yet', () => {
    expect(() => hidePlotGraphicsFromAt(null)).not.toThrow();
    expect(() => hidePlotGraphicsFromAt(undefined)).not.toThrow();
    expect(() => hidePlotGraphicsFromAt(document.createElement('div'))).not.toThrow();
  });
});
