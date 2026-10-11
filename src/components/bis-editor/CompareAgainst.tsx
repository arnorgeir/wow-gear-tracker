'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import { LABEL_CLASS } from '@/components/shared/field-classes';
import { LIST_NAMES } from '@/components/shared/list-names';
import { LIST_TYPES, type ListType } from '@/core/types';

export function CompareAgainst({ specSlug, listType }: { specSlug: string; listType: ListType }) {
  const { error, run } = useApiAction();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`mb-1.5 ${LABEL_CLASS}`}>Compare against</legend>
      <div className="flex flex-wrap gap-4">
        {LIST_TYPES.map((value) => (
          <label key={value} className="flex h-11 items-center gap-2 font-semibold">
            <input type="radio" name="compare-list" checked={listType === value}
              onChange={() => run('/api/bis/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, listType: value }) }, { after: 'refresh-always' })}
              className="size-[18px] accent-[var(--color-gold)]" />
            {LIST_NAMES[value]}
          </label>
        ))}
      </div>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </fieldset>
  );
}
