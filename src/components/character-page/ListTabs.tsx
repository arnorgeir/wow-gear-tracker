import Link from 'next/link';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { CharacterPageView } from '@/server/views';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

export function ListTabs({ id, listType, counts }: Pick<CharacterPageView, 'id' | 'listType' | 'counts'>) {
  return (
    <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
      {LIST_TYPES.map((l) => (
        <Link key={l} href={`/characters/${id}?list=${l}`} aria-current={l === listType ? 'page' : undefined}
          className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
          {LIST_NAMES[l]} <span className="font-mono text-sm">{counts[l].bis}/{counts[l].total}</span>
        </Link>
      ))}
    </nav>
  );
}
