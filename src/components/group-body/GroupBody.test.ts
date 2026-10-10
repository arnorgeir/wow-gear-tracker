import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import { GroupBody } from './GroupBody';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const p = (text: string) => createElement('p', null, text);
const render = (keys: string[], hasContent: boolean) => renderToStaticMarkup(createElement(GroupEditsProvider, { keys },
  createElement(GroupBody, {
    legend: p('legend'), empty: p('Pick up to five characters'),
    content: hasContent ? { notice: null, gear: p('real grid'), dungeons: p('real dungeons'), vault: p('real vault'), dungeonCount: 7 } : null,
  })));

describe('GroupBody', () => {
  it('renders the server panels once settled', () => {
    const html = render(['eu.argent-dawn.birkibjörn'], true);
    expect(html).toContain('real grid');
    expect(html).toContain('legend');
    expect(html).toContain('>7</span>');
    expect(html).not.toContain('animate-pulse');
  });

  it('renders the empty text for an empty group', () => {
    expect(render([], false)).toBe('<p>Pick up to five characters</p>');
  });
});
