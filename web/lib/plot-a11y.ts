/**
 * Makes a rendered Plotly chart legible to assistive tech. Must run after EVERY render.
 *
 * The charts' accessible content is the text summary rendered by ChartCard; the SVG itself is
 * noise — hundreds of loose tick and label text nodes. The obvious fix, aria-hidden on the
 * whole plot, is wrong: Plotly nests `.modebar-container` INSIDE `.svg-container` alongside
 * the `svg.main-svg` elements, so hiding the wrapper buries real, focusable buttons in an
 * aria-hidden subtree. A keyboard user then tabs onto a control no screen reader can announce
 * (axe `aria-hidden-focus`).
 *
 * So: hide the graphics siblings individually, and leave the mode bar exposed and named.
 */
export function hidePlotGraphicsFromAt(graphDiv: HTMLElement | null | undefined): void {
  const container = graphDiv?.querySelector('.svg-container');
  if (!container) return;

  for (const child of Array.from(container.children)) {
    if (child.classList.contains('modebar-container')) {
      child.removeAttribute('aria-hidden');
    } else {
      child.setAttribute('aria-hidden', 'true');
    }
  }

  // Plotly labels its buttons with `data-title` tooltips, which are not accessible names.
  for (const button of Array.from(container.querySelectorAll('.modebar-btn'))) {
    const title = button.getAttribute('data-title');
    if (title && !button.getAttribute('aria-label')) button.setAttribute('aria-label', title);
  }
}
