'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import { LIST_NAMES } from '@/components/shared/list-names';
import { LIST_TYPES, type ListType } from '@/core/types';

const HEADING = 'mb-2.5 p-0 text-[13px] font-bold uppercase tracking-[0.08em] text-muted';

export function CompareAgainst({ specSlug, listType }: { specSlug: string; listType: ListType }) {
  const { error, run } = useApiAction();
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className={HEADING}>Compare against</legend>
      <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-line bg-bg p-1 md:inline-flex md:w-fit">
        {LIST_TYPES.map((value) => (
          <label key={value}
            className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 text-[15px] font-semibold text-muted has-[:checked]:bg-gold-soft has-[:checked]:text-gold has-[:checked]:ring-1 has-[:checked]:ring-gold-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold md:h-10 md:justify-start md:gap-2 md:px-4">
            <input type="radio" name="compare-list" checked={listType === value}
              onChange={() => run('/api/bis/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, listType: value }) }, { after: 'refresh-always' })}
              className="size-4 accent-[var(--color-gold)]" />
            {LIST_NAMES[value]}
          </label>
        ))}
      </div>
      <span className="text-sm text-muted">Characters of this spec compare their gear against this list. Saved as you choose.</span>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </fieldset>
  );
}
