import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterCardView } from '@/server/views/types';
import { CharacterCard } from './CharacterCard';
import { CharacterCardSkeleton } from './CharacterCardSkeleton';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const counts = { done: 5, mythUpgradable: 2, belowMyth: 3, wrongStats: 0, missing: 6, inBags: 0 };
const card = (over: Partial<CharacterCardView>): CharacterCardView => ({
  id: 3, href: '/characters/eu/argent-dawn/birkibj%C3%B6rn', name: 'Birkibjörn', realmName: 'Argent Dawn', realmId: 1, region: 'eu',
  className: 'Druid', activeSpec: 'Guardian', spec: 'Guardian', specSlug: 'guardian-druid', status: 'ok', lastSyncedAt: 5, lastSyncError: null,
  priorityList: 'mythicPlus', snapshot: null, sourceAt: null, race: null, faction: null, avatarUrl: null, classIconUrl: null, identity: 'Guardian Druid',
  counts, tracksError: null, tracksKnown: true, tracksLoading: false, total: 16, bisError: null, crests: null, upgradesReady: 0, ...over,
});
const render = (c: CharacterCardView) => renderToStaticMarkup(createElement(CharacterCard, { card: c, now: 10 })).replace(/<link[^>]*\/>/g, '');
const statuses = (html: string) => html.match(/role="status"/g)?.length ?? 0;

describe('CharacterCard loading states', () => {
  it('shows a progress skeleton while the BiS list loads, saying so only to screen readers', () => {
    const html = render(card({ counts: null }));
    expect(html).toContain('animate-pulse');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading BiS list…<\/span>/);
    expect(statuses(html)).toBe(1);
  });

  it('keeps the error text, not a skeleton, when the BiS list failed', () => {
    const html = render(card({ counts: null, bisError: 'Method’s page couldn’t be read.' }));
    expect(html).toContain('Method’s page couldn’t be read.');
    expect(html).not.toContain('animate-pulse');
  });

  it('keeps the real bar and skeletons only the summary while track data loads', () => {
    const html = render(card({ tracksLoading: true, tracksKnown: false }));
    expect(html).toContain('bg-gold');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading upgrade track data…<\/span>/);
    expect(html).toContain('animate-pulse');
  });

  it('shows no skeleton once everything has loaded', () => {
    expect(render(card({}))).not.toContain('animate-pulse');
  });
});

describe('CharacterCardSkeleton', () => {
  it('is all shapes without a name, and has no status of its own', () => {
    const html = renderToStaticMarkup(createElement(CharacterCardSkeleton));
    expect(html).toContain('animate-pulse');
    expect(statuses(html)).toBe(0);
  });

  it('shows the name and says it is being added', () => {
    const html = renderToStaticMarkup(createElement(CharacterCardSkeleton, { name: 'Birkibjörn' }));
    expect(html).toContain('>Birkibjörn<');
    expect(html).toMatch(/<span role="status" class="text-sm text-muted">Adding Birkibjörn…<\/span>/);
    expect(statuses(html)).toBe(1);
  });
});
