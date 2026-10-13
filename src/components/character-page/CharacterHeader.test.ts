import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterPageView } from '@/server/views/types';
import { CharacterHeader } from './CharacterHeader';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const view = {
  id: 3, name: 'Birkibjörn', realmName: 'Argent Dawn', region: 'eu', className: 'Druid', identity: 'Troll Guardian Druid', avatarUrl: null, classIconUrl: null,
  itemLevel: null, snapshot: null, sourceAt: null, specIconUrl: 'https://render/guardian.jpg',
} as unknown as CharacterPageView;

describe('CharacterHeader', () => {
  it('puts the spec icon on the spec line', () => {
    const html = renderToStaticMarkup(createElement(CharacterHeader, { view, now: 0 }));
    expect(html).toContain('src="https://render/guardian.jpg"');
    expect(html).toContain('Troll Guardian Druid');
  });
});
