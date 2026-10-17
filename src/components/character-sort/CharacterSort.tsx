'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { viewCookie } from '@/components/view-toggle/view-cookie';
import { CHARACTERS_SORT_COOKIE, CHARACTERS_SORT_OPTIONS, type CharactersSort, type SortKey } from './characters-sort';

/** Sort key and direction, remembered in the `characters-sort` cookie. The server's `sort` is the committed value; the choice shows at once and settles back to it after the refresh. */
export function CharacterSort({ sort }: { sort: CharactersSort }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(sort);

  function choose(next: CharactersSort) {
    startTransition(() => {
      setShown(next);
      document.cookie = viewCookie(CHARACTERS_SORT_COOKIE, `${next.key}.${next.dir}`);
      router.refresh();
    });
  }

  const word = shown.dir === 'asc' ? 'Ascending' : 'Descending';
  const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';
  return (
    <div className={`flex items-center gap-2 ${pending ? 'opacity-60' : ''}`} aria-busy={pending || undefined}>
      <label htmlFor={CHARACTERS_SORT_COOKIE} className="text-[15px] font-semibold text-muted">Sort by</label>
      <select id={CHARACTERS_SORT_COOKIE} value={shown.key}
        onChange={(e) => choose({ key: e.target.value as SortKey, dir: CHARACTERS_SORT_OPTIONS.find((o) => o.key === e.target.value)!.dir })}
        className={`h-9 rounded-xl border border-line bg-bg px-3 text-[15px] font-semibold ${focus}`}>
        {CHARACTERS_SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <button type="button" aria-label={`Sort direction: ${word}`}
        onClick={() => choose({ key: shown.key, dir: shown.dir === 'asc' ? 'desc' : 'asc' })}
        className={`flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3 text-[15px] font-semibold text-muted ${focus}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {shown.dir === 'asc' ? <path d="M8 13V3M4 7l4-4 4 4" /> : <path d="M8 3v10M4 9l4 4 4-4" />}
        </svg>
        {word}
      </button>
    </div>
  );
}
