import Link from 'next/link';
import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';
import type { DungeonPageView } from '@/server/views/types';
import { BossOverview } from './BossTactics';
import { guideHref } from './guide-state';

/** A boss's journal overview, or the dungeon's art with one entry per boss when no boss is chosen. */
export function OverviewTab({ view, bossId }: { view: DungeonPageView; bossId: number | null }) {
  const boss = view.bosses.find((b) => b.encounterId === bossId);
  if (boss) return <BossOverview tactics={boss.tactics} />;
  return (
    <div className="flex flex-col gap-4">
      <DungeonThumbnail imageUrl={view.imageUrl} shortName={view.shortName} className="aspect-video w-full rounded-lg" />
      <ul className="flex flex-col gap-3">
        {view.bosses.map((b) => (
          <li key={b.encounterId} className="flex flex-col gap-0.5">
            <h3 className="font-display font-bold">
              <Link href={guideHref(view.challengeModeId, { boss: b.encounterId, tab: 'overview' })} className="text-gold hover:underline focus-visible:outline-2 focus-visible:outline-gold">{b.name}</Link>
            </h3>
            {b.tactics?.description && <p className="text-sm text-muted">{b.tactics.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
