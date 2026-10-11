import Link from 'next/link';
import { badgeText } from './badge-text';

/** Where the compared list comes from, linking to its editor. Says how many slots the account has edited. */
export function BisSourceBadge({ specSlug, editedCount }: { specSlug: string; editedCount: number }) {
  return (
    <Link href={`/settings/bis/${specSlug}`}
      className="rounded-full border border-line-strong px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-ink no-underline hover:border-gold">
      {badgeText('Method', editedCount)}
    </Link>
  );
}
