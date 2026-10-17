'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CharactersView } from './characters-view';
import { viewCookie } from './view-cookie';

const ICON = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true } as const;
const OPTIONS: { value: CharactersView; label: string; icon: React.ReactNode }[] = [
  { value: 'grid', label: 'Grid', icon: <svg {...ICON}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg> },
  { value: 'list', label: 'List', icon: <svg {...ICON}><path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" /></svg> },
];

/** Grid or list, remembered in the `cookie` cookie; `name` groups the radios. The server's `view` is the committed value; the choice shows at once and settles back to it after the refresh. */
export function ViewToggle({ view, cookie, name }: { view: CharactersView; cookie: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(view);

  function choose(next: CharactersView) {
    startTransition(() => {
      setShown(next);
      document.cookie = viewCookie(cookie, next);
      router.refresh();
    });
  }

  return (
    <fieldset className="m-0 border-0 p-0" aria-busy={pending || undefined}>
      <legend className="sr-only">Layout</legend>
      <div className={`inline-flex gap-1 rounded-xl border border-line bg-bg p-1 ${pending ? 'opacity-60' : ''}`}>
        {OPTIONS.map(({ value, label, icon }) => (
          <label key={value}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3 text-[15px] font-semibold text-muted has-[:checked]:bg-gold-soft has-[:checked]:text-gold has-[:checked]:ring-1 has-[:checked]:ring-gold-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold">
            <input type="radio" name={name} value={value} checked={shown === value} onChange={() => choose(value)} className="size-4 accent-[var(--color-gold)]" />
            {icon}{label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
