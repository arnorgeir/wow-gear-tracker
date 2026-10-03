'use client';

import { useRouter } from 'next/navigation';
import { groupHref, removeMember } from '@/core/characters/member-key';

/** Membership is the URL, so removing a member is a navigation, not a request. */
export function RemoveFromGroupButton({ memberKey, name, keys, variant = 'icon' }: { memberKey: string; name: string; keys: string[]; variant?: 'icon' | 'text' }) {
  const router = useRouter();
  const remove = () => router.replace(groupHref(removeMember(keys, memberKey)));
  if (variant === 'text') {
    return <button type="button" onClick={remove} className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold">Remove from group</button>;
  }
  return (
    <button type="button" onClick={remove} aria-label={`Remove ${name} from group`}
      className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}
