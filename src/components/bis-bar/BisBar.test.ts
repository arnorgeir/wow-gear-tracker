import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BisBar } from './BisBar';

describe('BisBar', () => {
  it('renders five hidden segments', () => {
    const html = renderToStaticMarkup(createElement(BisBar, { bar: { done: 1, mythUpgradable: 1, belowMyth: 1, wrongStats: 1, rest: 1 } }));
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/<div/g)).toHaveLength(6);
  });
});
