import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PendingCharacterProvider } from '@/components/pending-character/PendingCharacterProvider';
import { AddCharacterBar } from './AddCharacterBar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

describe('AddCharacterBar', () => {
  it('keeps an empty adding status mounted beside a pending card grid, so the add is announced when its text arrives', () => {
    const html = renderToStaticMarkup(createElement(PendingCharacterProvider, null, createElement(AddCharacterBar, { trackedCharacters: [] })));
    expect(html).toContain('<span role="status" class="sr-only"></span>');
  });
});
