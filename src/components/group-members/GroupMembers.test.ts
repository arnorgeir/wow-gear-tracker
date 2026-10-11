import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import { GroupMembers } from './GroupMembers';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

describe('GroupMembers', () => {
  it('keeps an empty status mounted, so screen readers announce an edit when its text arrives', () => {
    const html = renderToStaticMarkup(createElement(GroupEditsProvider, { keys: [] },
      createElement(GroupMembers, { members: [], region: null, available: [], tracked: [] })));
    expect(html).toContain('<span role="status" class="sr-only"></span>');
  });
});
