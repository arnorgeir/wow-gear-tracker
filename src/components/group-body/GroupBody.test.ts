import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GroupEditsContext, GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import type { GroupMemberView } from '@/server/views/types';
import { GroupBody } from './GroupBody';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const p = (text: string) => createElement('p', null, text);
const render = (keys: string[], hasContent: boolean) => renderToStaticMarkup(createElement(GroupEditsProvider, { keys },
  createElement(GroupBody, {
    legend: p('legend'), empty: p('Pick up to five characters'),
    content: hasContent ? { notice: null, grid: { members: [], rows: [], tracksKnown: true }, dungeons: p('real dungeons'), vault: p('real vault'), dungeonCount: 7 } : null,
  })));

describe('GroupBody', () => {
  it('renders the server panels once settled', () => {
    const html = render(['eu.argent-dawn.birkibjörn'], true);
    expect(html).toContain('Gear by slot');
    expect(html).toContain('legend');
    expect(html).toContain('>7</span>');
    expect(html).not.toContain('animate-pulse');
  });

  it('renders the empty text for an empty group', () => {
    expect(render([], false)).toBe('<p>Pick up to five characters</p>');
  });

  it('keeps the dungeon and vault panels while a reorder loads, with headers in the requested order', () => {
    const member = (key: string, name: string) => ({
      key, name, realmSlug: 'argent-dawn', character: null, state: 'ready', syncError: null, bisError: null, bisLoading: false,
      hasRows: true, listType: 'mythicPlus', fellBack: false, source: 'method', crests: null,
    }) as GroupMemberView;
    const a = 'eu.argent-dawn.birkibjörn';
    const b = 'eu.argent-dawn.hrafnhildur';
    const noop = () => {};
    const html = renderToStaticMarkup(createElement(GroupEditsContext.Provider,
      { value: { keys: [b, a], pending: true, add: noop, remove: noop, move: noop, moved: null } },
      createElement(GroupBody, {
        legend: p('legend'), empty: p('empty'),
        content: { notice: null, grid: { members: [member(a, 'Birkibjörn'), member(b, 'Hrafnhildur')], rows: [], tracksKnown: true }, dungeons: p('real dungeons'), vault: p('real vault'), dungeonCount: 7 },
      })));
    expect(html).toContain('real dungeons');
    expect(html).toContain('real vault');
    expect(html).not.toContain('animate-pulse');
    expect(html.indexOf('Hrafnhildur')).toBeLessThan(html.indexOf('Birkibjörn'));
  });
});
