import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import type { GroupMemberView } from '@/server/views/types';
import { GroupMembers } from './GroupMembers';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

describe('GroupMembers', () => {
  it('keeps an empty status mounted, so screen readers announce an edit when its text arrives', () => {
    const html = renderToStaticMarkup(createElement(GroupEditsProvider, { keys: [] },
      createElement(GroupMembers, { members: [], region: null, available: [], tracked: [] })));
    expect(html).toContain('<span role="status" class="sr-only"></span>');
  });

  const member = (key: string, name: string) => ({
    key, name, realmSlug: 'argent-dawn', character: null, state: 'ready', syncError: null, bisError: null, bisLoading: false,
    hasRows: true, listType: 'mythicPlus', fellBack: false, source: 'method', crests: null,
  }) as GroupMemberView;
  const renderGroup = (members: GroupMemberView[]) => renderToStaticMarkup(createElement(GroupEditsProvider, { keys: members.map((m) => m.key) },
    createElement(GroupMembers, { members, region: 'eu', available: [], tracked: [] })));

  it('gives each of two members a move handle that scrolling cannot steal', () => {
    const html = renderGroup([member('eu.argent-dawn.birkibjörn', 'Birkibjörn'), member('eu.argent-dawn.hrafnhildur', 'Hrafnhildur')]);
    expect(html).toMatch(/aria-label="Move Birkibjörn, position 1 of 2"[^>]*class="[^"]*touch-none/);
    expect(html).toMatch(/aria-label="Move Hrafnhildur, position 2 of 2"[^>]*class="[^"]*touch-none/);
    expect(html).toContain('id="group-move-hint"');
  });

  it('has no handle for a lone member', () => {
    expect(renderGroup([member('eu.argent-dawn.birkibjörn', 'Birkibjörn')])).not.toContain('aria-label="Move ');
  });
});
