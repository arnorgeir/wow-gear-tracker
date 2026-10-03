import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterSummary, GroupGridRow, GroupMemberView } from '@/server/views/types';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import { GroupGrid } from './GroupGrid';

// Client children need the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const summary = (id: number, name: string): CharacterSummary => ({
  id, name, realmName: 'Argent Dawn', realmId: 1, region: 'eu', className: 'Druid', activeSpec: 'Guardian', spec: 'Guardian', specSlug: 'guardian-druid',
  status: 'ok', lastSyncedAt: 5, lastSyncError: null, priorityList: 'mythicPlus', snapshot: null, sourceAt: null, race: null, faction: null,
  avatarUrl: null, classIconUrl: null, identity: 'Guardian Druid',
});
const member = (over: Partial<GroupMemberView>): GroupMemberView => ({
  key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', realmSlug: 'argent-dawn', character: null, state: 'ready',
  syncError: null, bisError: null, hasRows: true, listType: 'mythicPlus', fellBack: false, crests: null, ...over,
});
const render = (members: GroupMemberView[], grid: GroupGridRow[]) =>
  renderToStaticMarkup(createElement(GroupEditsProvider, { keys: members.map((m) => m.key) }, createElement(GroupGrid, { members, grid, tracksKnown: true, now: 0 }))).replace(/<link[^>]*\/>/g, '');

describe('GroupGrid', () => {
  it('shows each member state in words', () => {
    const html = render([
      member({ key: 'eu.argent-dawn.gnúpur', name: 'gnúpur', state: 'untracked', hasRows: false }),
      member({ key: 'eu.argent-dawn.sólrún', name: 'Sólrún', state: 'noGear', hasRows: false, syncError: 'Blizzard returned 503', character: summary(7, 'Sólrún') }),
      member({ key: 'eu.argent-dawn.ylfa', name: 'Ylfa', state: 'notFound', hasRows: false }),
    ], [{ slot: 'HEAD', label: 'Head', cells: [null, null, null] }]);
    expect(html).toContain('Not tracked');
    expect(html).toContain('Track');
    expect(html).toContain('Couldn’t sync: Blizzard returned 503');
    expect(html).toContain('Blizzard can’t find this character');
    expect(html).toContain('Remove from group');
  });

  it('names the list a member uses, and the fallback', () => {
    const html = render([member({ listType: 'overall', fellBack: true, character: summary(3, 'Birkibjörn') })], []);
    expect(html).toContain('Overall, Method has no Mythic+ list');
  });
});
