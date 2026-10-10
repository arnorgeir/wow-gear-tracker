'use client';

import Link from 'next/link';
import { useListSwitch } from '@/components/list-switch/ListSwitchProvider';
import { LIST_LOADING } from '@/components/shared/loading-copy';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { CharacterPageView } from '@/server/views/types';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

export function ListTabs({ href, counts }: Pick<CharacterPageView, 'href' | 'counts'>) {
  const { listType, pending, select } = useListSwitch();
  return (
    <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
      {/* Always mounted: screen readers skip a live region that arrives with its text. */}
      <span role="status" className="sr-only">{pending ? LIST_LOADING : ''}</span>
      {LIST_TYPES.map((l) => {
        const tabHref = `${href}?list=${l}`;
        return (
          // onNavigate runs only for a plain client-side click, so middle-click and modifier clicks still open new tabs.
          <Link key={l} href={tabHref} aria-current={l === listType ? 'page' : undefined}
            onNavigate={(e) => { e.preventDefault(); if (l !== listType) select(l, tabHref); }}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]} <span className="font-mono text-sm">{counts[l].bis}/{counts[l].total}</span>
          </Link>
        );
      })}
    </nav>
  );
}
