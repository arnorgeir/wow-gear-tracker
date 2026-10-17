import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BisSourceId, ListType } from '@/core/types';
import { VaultHistory } from '@/components/vault-history/VaultHistory';
import { VaultSection } from './VaultSection';

const base = { id: 1, vault: [], vaultChoices: [], vaultChoicesAt: null, vaultHistoryBefore: null as number | null, specSlug: 'guardian-druid', listType: 'mythicPlus' as ListType, bisSource: 'method' as BisSourceId, bisFetchedAt: 500 as number | null, editedCount: 0, now: 0 };

/** The key React gives the history: a new key remounts it, dropping weeks marked against another list. */
function historyKey(node: ReactNode): string | null {
  if (Array.isArray(node)) return node.map(historyKey).find((k) => k !== null) ?? null;
  if (!isValidElement(node)) return null;
  if (node.type === VaultHistory) return node.key;
  return historyKey((node.props as { children?: ReactNode }).children);
}

describe('VaultSection', () => {
  it('puts a gold vault icon in the heading and says plainly when there is no paste this week', () => {
    const html = renderToStaticMarkup(createElement(VaultSection, base));
    expect(html).toMatch(/<h2 class="flex items-center gap-2\.5[^"]*"><svg[^>]*aria-hidden="true"[^>]*class="shrink-0 text-gold"[^>]*>.*<\/svg>Great Vault<\/h2>/);
    expect(html).toContain('No SimC import with Great Vault data this week.');
    expect(html).toContain('Paste SimC to see your Great Vault choices.');
    expect(html).not.toContain('No item choices in the vault');
  });

  it('shows the history button only when an earlier week has a paste', () => {
    expect(renderToStaticMarkup(createElement(VaultSection, base))).not.toContain('Great Vault history');
    expect(renderToStaticMarkup(createElement(VaultSection, { ...base, vaultHistoryBefore: 1000 }))).toContain('Great Vault history');
  });

  it('remounts the history when the compared spec, list or week changes', () => {
    const key = (p: Partial<typeof base>) => historyKey(VaultSection({ ...base, ...p }));
    const first = key({ vaultHistoryBefore: 1000 });
    expect(first).not.toBeNull();
    expect(key({ vaultHistoryBefore: 1000 })).toBe(first);
    expect(key({ vaultHistoryBefore: 1000, listType: 'raid' })).not.toBe(first);
    expect(key({ vaultHistoryBefore: 1000, specSlug: 'feral-druid' })).not.toBe(first);
    expect(key({ vaultHistoryBefore: 2000 })).not.toBe(first);
    // A background BiS fetch or an edit changes the list's contents under the same spec and list.
    expect(key({ vaultHistoryBefore: 1000, bisFetchedAt: 900 })).not.toBe(first);
    expect(key({ vaultHistoryBefore: 1000, bisFetchedAt: null })).not.toBe(first);
    expect(key({ vaultHistoryBefore: 1000, editedCount: 2 })).not.toBe(first);
    expect(key({ vaultHistoryBefore: 1000, bisSource: 'manual' })).not.toBe(first);
  });
});
