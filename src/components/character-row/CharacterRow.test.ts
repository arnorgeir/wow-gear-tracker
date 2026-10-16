import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterCardView } from '@/server/views/types';
import { CharacterRow } from './CharacterRow';
import { CharacterRowSkeleton } from './CharacterRowSkeleton';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const counts = { done: 5, mythUpgradable: 2, belowMyth: 3, wrongStats: 0, missing: 6, inBags: 0 };
const card = (over: Partial<CharacterCardView>): CharacterCardView => ({
  id: 3, href: '/characters/eu/argent-dawn/birkibj%C3%B6rn', name: 'Birkibjörn', realmName: 'Argent Dawn', realmId: 1, region: 'eu',
  className: 'Druid', activeSpec: 'Guardian', spec: 'Guardian', specSlug: 'guardian-druid', status: 'ok', lastSyncedAt: 5, lastSyncError: null,
  listType: 'mythicPlus', snapshot: null, sourceAt: null, race: null, faction: null, avatarUrl: null, classIconUrl: null, identity: 'Guardian Druid', itemLevel: null,
  counts, tracksError: null, tracksKnown: true, tracksLoading: false, total: 16, bisError: null, crests: null, upgradesReady: 0, ...over,
});
const render = (c: CharacterCardView) => renderToStaticMarkup(createElement(CharacterRow, { card: c, now: 10 })).replace(/<link[^>]*\/>/g, '');
const statuses = (html: string) => html.match(/role="status"/g)?.length ?? 0;

describe('CharacterRow', () => {
  it('links the name to the character page, with the pending cue', () => {
    expect(render(card({}))).toMatch(/<a [^>]*href="\/characters\/eu\/argent-dawn\/birkibj%C3%B6rn"[^>]*><span class="[^"]*truncate[^"]*">Birkibjörn<\/span><span aria-hidden="true" class="[^"]*animate-spin/);
  });

  it('puts identity, then realm and item level, on lines of their own', () => {
    const html = render(card({ itemLevel: 642.34 }));
    expect(html).toMatch(/<span class="[^"]*truncate[^"]*" style="color:[^"]*">Guardian Druid<\/span>/);
    expect(html).toMatch(/<span class="[^"]*truncate[^"]*">Argent Dawn · <span class="font-mono">642.3<\/span> ilvl<\/span>/);
  });

  it('shows list label, count, bar and summary, and no crest chips', () => {
    const html = render(card({ crests: { balances: [{ currencyId: 3347, name: 'Myth Crest', quantity: 5, iconUrl: null, steps: 1 }], pastedAt: 5 } as never, upgradesReady: 2 }));
    expect(html).toContain('Mythic+ BiS');
    expect(html).toContain('<strong class="text-gold">10</strong>');
    expect(html).toContain('/ 16');
    expect(html).toContain('aria-hidden="true"><div class="bg-gold"');
    expect(html).toContain('5 done, 2 need crests, 3 vault targets');
    expect(html).not.toContain('data-wowhead');
    expect(html).not.toContain('upgrades ready');
  });

  it('has the remove button', () => {
    expect(render(card({}))).toContain('Remove');
  });

  it('says Blizzard can’t find a notFound character', () => {
    const html = render(card({ status: 'notFound', counts: null }));
    expect(html).toContain('Blizzard can’t find this character');
    expect(html).not.toContain('Mythic+ BiS');
  });

  it('shows a progress skeleton while the BiS list loads', () => {
    const html = render(card({ counts: null }));
    expect(html).toContain('animate-pulse');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading BiS list…<\/span>/);
    expect(statuses(html)).toBe(1);
  });

  it('keeps the error text when the BiS list failed', () => {
    const html = render(card({ counts: null, bisError: 'Method’s page couldn’t be read.' }));
    expect(html).toContain('Method’s page couldn’t be read.');
    expect(html).not.toContain('animate-pulse');
  });

  it('skeletons only the summary while track data loads', () => {
    const html = render(card({ tracksLoading: true, tracksKnown: false }));
    expect(html).toContain('bg-gold');
    expect(html).toMatch(/<span role="status" class="sr-only">Loading upgrade track data…<\/span>/);
  });

  it('shows track and sync errors', () => {
    const html = render(card({ tracksError: 'Track data failed', lastSyncError: 'Sync failed' }));
    expect(html).toContain('Track data failed.');
    expect(html).toContain('Sync failed');
  });

  it('shows the source text', () => {
    expect(render(card({}))).toContain('Not synced yet');
  });
});

describe('CharacterRowSkeleton', () => {
  it('is all shapes without a name, and has no status of its own', () => {
    const html = renderToStaticMarkup(createElement(CharacterRowSkeleton));
    expect(html).toContain('animate-pulse');
    expect(statuses(html)).toBe(0);
  });

  it('shows the name and says it is being added', () => {
    const html = renderToStaticMarkup(createElement(CharacterRowSkeleton, { name: 'Birkibjörn' }));
    expect(html).toContain('>Birkibjörn<');
    expect(html).toContain('Adding Birkibjörn…');
    expect(statuses(html)).toBe(0);
  });
});
