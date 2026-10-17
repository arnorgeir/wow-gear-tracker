import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VaultChoiceView } from '@/server/views/types';
import { VaultChoiceList } from './VaultChoiceList';

const choice = (itemId: number, isBis: boolean): VaultChoiceView =>
  ({ itemId, name: `Item ${itemId}`, quality: 'EPIC', iconUrl: null, bonusIds: [], itemLevel: 330, trackLabel: null, isBis });
const render = (c: VaultChoiceView) => renderToStaticMarkup(createElement(VaultChoiceList, { choices: [c] }));

describe('VaultChoiceList', () => {
  it('frames a BiS row in gold with a badge', () => {
    const html = render(choice(1, true));
    expect(html).toContain('border-gold');
    expect(html).toContain('>BiS<');
    expect(html).not.toContain('Not BiS');
  });

  it('leaves a non-BiS row unframed', () => {
    const html = render(choice(2, false));
    expect(html).toContain('border-transparent');
    expect(html).toContain('Not BiS');
    expect(html).not.toContain('border-gold');
  });
});
