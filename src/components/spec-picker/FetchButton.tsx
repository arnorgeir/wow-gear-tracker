'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import type { FetchAction } from './fetch-state';

const HEIGHT = { sm: 'h-9', md: 'h-10', lg: 'h-11' } as const;

interface Props {
  specSlug: string;
  label: FetchAction;
  size?: keyof typeof HEIGHT;
  /** A text link instead of a button, for a phone header with no room. */
  link?: boolean;
}

export function FetchButton({ specSlug, label, size = 'sm', link }: Props) {
  const { busy, error, run } = useApiAction();
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={busy}
        onClick={() => run('/api/bis/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specSlug }) })}
        className={link
          ? 'text-gold underline-offset-2 hover:underline disabled:opacity-60'
          : `${HEIGHT[size]} rounded-lg border border-line-strong bg-raised px-3 text-sm font-semibold disabled:opacity-60`}>
        {busy ? 'Fetching…' : label}
      </button>
      {error && <span role="alert" className="text-sm text-missing">{error}</span>}
    </span>
  );
}
