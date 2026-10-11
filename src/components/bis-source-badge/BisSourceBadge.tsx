import Link from 'next/link';
import { badgeText } from './badge-text';

/** Where the compared list comes from, linking to its editor. A gold edge and count say when the account edited it. */
export function BisSourceBadge({ specSlug, editedCount }: { specSlug: string; editedCount: number }) {
  const { source, edited } = badgeText('Method', editedCount);
  return (
    <Link href={`/settings/bis/${specSlug}`}
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold text-ink no-underline hover:brightness-125 ${edited ? 'border-gold-line bg-gold-soft' : 'border-line-strong bg-surface-2'}`}>
      {source}
      {edited && <><span aria-hidden="true" className="text-dim">·</span><span className="text-gold">{edited}</span></>}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted"><path d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}
