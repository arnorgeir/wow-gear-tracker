import Link from 'next/link';
import { Fragment } from 'react';

/** Dungeon names as comma-separated links to their pages. */
export function DungeonLinks({ dungeons }: { dungeons: { challengeModeId: number; name: string }[] }) {
  return dungeons.map((d, i) => (
    <Fragment key={d.challengeModeId}>{i > 0 && ', '}<Link href={`/dungeons/${d.challengeModeId}`}>{d.name}</Link></Fragment>
  ));
}
