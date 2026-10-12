import Link from 'next/link';
import { editedText } from '@/components/shared/edited-text';
import { LIST_NAMES } from '@/components/shared/list-names';
import { LIST_TYPES } from '@/core/types';
import type { SettingsSpecView } from '@/server/views/types';
import { tabSub } from './editor-text';

/** Which of the source's lists to edit. The compared list says so in words, and every tab counts its edits. */
export function ListTabs({ view }: { view: SettingsSpecView }) {
  return (
    <>
      <nav aria-label="Lists to edit" className="hidden gap-2 border-b border-line md:flex">
        {LIST_TYPES.map((l) => {
          const current = l === view.editing;
          return (
            <Link key={l} href={`/settings/bis/${view.slug}?list=${l}`} aria-current={current ? 'page' : undefined}
              className={`-mb-px flex items-center gap-2.5 border-b-2 px-4 py-3 text-base font-semibold no-underline ${current ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
              {LIST_NAMES[l]}
              {l === view.listType && (
                <span className="inline-flex h-[22px] items-center gap-[5px] rounded-[11px] border border-gold-line bg-gold-soft px-2 text-xs font-bold text-gold">
                  <span aria-hidden="true" className="size-1.5 rotate-45 bg-gold" />Compared
                </span>
              )}
              <span className="text-[13px] font-medium text-muted">{editedText(view.lists[l].editedCount)}</span>
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Lists to edit" className="grid grid-cols-3 border-b border-line md:hidden">
        {LIST_TYPES.map((l) => {
          const current = l === view.editing;
          return (
            <Link key={l} href={`/settings/bis/${view.slug}?list=${l}`} aria-current={current ? 'page' : undefined}
              className={`-mb-px flex flex-col items-center gap-0.5 border-b-2 py-2.5 text-[15px] font-semibold no-underline ${current ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
              <span className="flex items-center gap-1.5">
                {l === view.listType && <span aria-hidden="true" className="size-[7px] rotate-45 bg-gold" />}
                {LIST_NAMES[l]}
              </span>
              <span className="text-xs font-medium text-muted">{tabSub(view.lists[l].editedCount, l === view.listType)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
