import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CrestBalance } from '@/core/gear/crests';
import { CrestChip } from './CrestChip';

const myth: CrestBalance = { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: 'https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg' };
const render = (balance: CrestBalance, showSteps = false) => renderToStaticMarkup(createElement(CrestChip, { balance, showSteps }));

describe('CrestChip', () => {
  it('shows the icon and count, with the full label on hover and for screen readers', () => {
    const html = render(myth);
    expect(html).toContain('src="https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg"');
    expect(html).toContain('>85<');
    expect(html).toContain('title="Myth Mistcrest: 85, 4 steps"');
    expect(html).toContain('<span class="sr-only">Myth Mistcrest: 85, 4 steps</span>');
  });

  it('links to the Wowhead currency as well, so the tooltip works when the page loads it', () => {
    const html = render(myth);
    expect(html).toContain('href="https://www.wowhead.com/currency=3446"');
    expect(html).toContain('data-wowhead="currency=3446"');
  });

  it('writes the affordable steps out when there is room', () => {
    expect(render(myth, true)).toContain('>(4 steps)<');
    expect(render({ ...myth, steps: 1 }, true)).toContain('>(1 step)<');
    expect(render(myth)).not.toContain('(4 steps)');
  });

  it('shows no step count when the upgrade cost is unknown', () => {
    expect(render({ ...myth, steps: null }, true)).not.toContain('step');
  });

  it('falls back to the first word of the name without an icon', () => {
    const html = render({ ...myth, iconUrl: null });
    expect(html).not.toContain('<img');
    expect(html).toContain('>Myth<');
  });
});
