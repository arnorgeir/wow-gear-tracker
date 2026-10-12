'use client';

import { useState } from 'react';
import { useApiAction } from '@/components/hooks/use-api-action';
import { SOURCE_NAMES, type FetchedSourceId } from '@/core/types';
import { copyChoices, copyConfirm } from './copy-again';

const BUTTON = 'h-9 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm font-semibold text-ink hover:brightness-125 disabled:opacity-60';

/** Replaces the manual list with a fresh copy of a fetched source, after an inline confirm. */
export function CopyAgain({ specSlug, copiedFrom }: { specSlug: string; copiedFrom: FetchedSourceId | null }) {
  const [pending, setPending] = useState<FetchedSourceId | null>(null);
  const { busy, error, run } = useApiAction();
  const replace = async (from: FetchedSourceId) => {
    const result = await run('/api/bis/manual/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug, from }) });
    if (result.ok) setPending(null);
  };
  return (
    <details className="relative">
      <summary className="cursor-pointer text-sm font-semibold text-gold">Copy again</summary>
      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 md:absolute md:right-0 md:z-10 md:w-80">
        {pending === null ? (
          <div className="flex flex-wrap gap-2">
            {copyChoices(copiedFrom).map((from) => (
              <button key={from} type="button" className={BUTTON} onClick={() => setPending(from)}>From {SOURCE_NAMES[from]}</button>
            ))}
          </div>
        ) : (
          <>
            <span className="text-sm text-ink">{copyConfirm(pending)}</span>
            <div className="flex gap-2">
              <button type="button" className={BUTTON} disabled={busy} onClick={() => replace(pending)}>Replace</button>
              <button type="button" className={BUTTON} disabled={busy} onClick={() => setPending(null)}>Cancel</button>
            </div>
          </>
        )}
        {error && <span role="alert" className="text-sm text-missing">{error}</span>}
      </div>
    </details>
  );
}
