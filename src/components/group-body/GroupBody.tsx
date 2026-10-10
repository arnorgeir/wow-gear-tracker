'use client';

import type { ReactNode } from 'react';
import { useGroupEdits } from '@/components/group-edits/GroupEditsProvider';
import { GroupGrid } from '@/components/group-grid/GroupGrid';
import { GroupGridSkeleton } from '@/components/group-grid/GroupGridSkeleton';
import { GroupLayout } from '@/components/group-layout/GroupLayout';
import { GroupPrioritySkeleton } from '@/components/group-priority/GroupPrioritySkeleton';
import { GroupVaultSkeleton } from '@/components/group-vault/GroupVaultSkeleton';
import type { GroupGridRow, GroupMemberView } from '@/server/views/types';
import { groupBodyMode } from './group-body-mode';
import { PANEL_BOX } from './panel-box';

export interface GroupBodyContent {
  notice: ReactNode;
  /** The grid's data, not a rendered node: while the group changes, the client re-lays it out with pending columns. */
  grid: { members: GroupMemberView[]; rows: GroupGridRow[]; tracksKnown: boolean };
  dungeons: ReactNode;
  vault: ReactNode;
  dungeonCount: number;
}

/**
 * The group page below the picker. It reads the membership asked for, which runs ahead of the server's render
 * during an edit: members already rendered keep their grid column, and each new one gets a skeleton column.
 * The group-wide dungeon and vault panels skeleton, as they depend on every member. Both branches render
 * GroupLayout at the same place, so the selected phone tab survives an edit.
 */
export function GroupBody({ legend, empty, content }: { legend: ReactNode; empty: ReactNode; content: GroupBodyContent | null }) {
  const { keys, pending } = useGroupEdits();
  const mode = groupBodyMode(pending, keys.length, content !== null);
  if (mode === 'empty') return <>{empty}</>;
  const live = mode === 'content' ? content : null;
  const gear = content
    ? <GroupGrid members={content.grid.members} grid={content.grid.rows} tracksKnown={content.grid.tracksKnown} requestedKeys={live ? undefined : keys} />
    : <GroupGridSkeleton members={keys.length} />;
  return (
    <>
      {live?.notice ?? null}
      <GroupLayout
        dungeonCount={live ? live.dungeonCount : null}
        legend={legend}
        gear={gear}
        dungeons={live ? live.dungeons : <div className={PANEL_BOX}><GroupPrioritySkeleton /></div>}
        vault={live ? live.vault : <div className={PANEL_BOX}><GroupVaultSkeleton /></div>}
      />
    </>
  );
}
