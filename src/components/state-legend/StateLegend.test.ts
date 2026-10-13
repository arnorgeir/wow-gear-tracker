import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StateLegend } from './StateLegend';

describe('StateLegend', () => {
  it('lists the states in card-bar order', () => {
    const html = renderToStaticMarkup(createElement(StateLegend));
    const labels = ['Done: Myth max', 'Upgrade with crests', 'Great Vault target', 'Wrong stats', 'BiS in bags', 'Missing'];
    const positions = labels.map((label) => html.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('keys wrong stats with the card bar color', () => {
    expect(renderToStaticMarkup(createElement(StateLegend))).toMatch(/bg-stats[^>]*><\/span>Wrong stats/);
  });
});
