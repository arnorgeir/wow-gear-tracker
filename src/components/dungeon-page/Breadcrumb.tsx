import Link from 'next/link';
import { guideHref, type GuideState } from './guide-state';

const LINK = 'text-muted hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-gold';

/** Dungeons / dungeon / boss. The last item is the current page and not a link. */
export function Breadcrumb({ dungeonId, dungeonName, bossName, keep }: { dungeonId: number; dungeonName: string; bossName: string | null; keep: Pick<GuideState, 'show' | 'who'> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li><Link href="/dungeons" className={LINK}>Dungeons</Link></li>
        <li aria-hidden="true" className="text-muted">/</li>
        <li>{bossName === null
          ? <span aria-current="page">{dungeonName}</span>
          : <Link href={guideHref(dungeonId, { ...keep, boss: null, tab: 'overview' })} className={LINK}>{dungeonName}</Link>}</li>
        {bossName !== null && (
          <>
            <li aria-hidden="true" className="text-muted">/</li>
            <li><span aria-current="page">{bossName}</span></li>
          </>
        )}
      </ol>
    </nav>
  );
}
