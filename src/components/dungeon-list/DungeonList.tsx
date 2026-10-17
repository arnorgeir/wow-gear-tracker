import Link from 'next/link';
import { DungeonThumbnail } from '@/components/dungeon-thumbnail/DungeonThumbnail';
import type { DungeonListView } from '@/server/views/types';

/** The season's dungeons as cards, each opening that dungeon's guide. */
export function DungeonList({ view }: { view: DungeonListView }) {
  return (
    <>
      <h1 className="font-display text-3xl font-bold">Dungeons</h1>
      {view.dungeons.length === 0 ? (
        <p className="text-muted">
          No season is loaded yet. It loads from a character page: <Link href="/" className="text-gold hover:underline focus-visible:outline-2 focus-visible:outline-gold">open Characters</Link>.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {view.dungeons.map((d) => (
            <li key={d.challengeModeId}>
              <Link href={`/dungeons/${d.challengeModeId}`}
                className="flex flex-col overflow-hidden rounded-xl border border-line-strong bg-surface no-underline hover:border-gold-line focus-visible:outline-2 focus-visible:outline-gold">
                <DungeonThumbnail imageUrl={d.imageUrl} shortName={d.shortName} className="aspect-video w-full" />
                <span className="p-3 font-display text-lg font-bold">{d.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
