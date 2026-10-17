'use client';

import { useId } from 'react';
import { InfoTip } from '@/components/info-tip/InfoTip';
import { useApiAction } from '@/components/hooks/use-api-action';
import type { BisSourceId } from '@/core/types';
import { sourceOptions } from './source-picker';

const HEADING = 'mb-3 p-0 text-[13px] font-bold uppercase tracking-[0.08em] text-muted';

/** Where the spec's list comes from. Saved as you choose; choosing Manual copies the current list. */
export function SourcePicker({ specSlug, source }: { specSlug: string; source: BisSourceId }) {
  const { error, run } = useApiAction();
  const tipId = useId();
  const titleId = useId();
  return (
    <fieldset aria-labelledby={titleId} aria-describedby={tipId} className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className={HEADING}><span className="inline-flex items-center gap-1.5"><span id={titleId}>BiS source</span><InfoTip id={tipId} title="BiS source">Where this spec&apos;s list comes from. Manual copies the current list for you to edit.</InfoTip></span></legend>
      <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-line bg-bg p-1 md:inline-flex md:w-fit">
        {sourceOptions().map(({ value, label }) => (
          <label key={value}
            className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 text-[15px] font-semibold text-muted has-[:checked]:bg-gold-soft has-[:checked]:text-gold has-[:checked]:ring-1 has-[:checked]:ring-gold-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold md:h-10 md:justify-start md:gap-2 md:px-4">
            <input type="radio" name="bis-source" value={value} checked={source === value}
              onChange={() => run('/api/bis/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, source: value }) }, { after: 'refresh-always' })}
              className="size-4 accent-[var(--color-gold)]" />
            {label}
          </label>
        ))}
      </div>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </fieldset>
  );
}
