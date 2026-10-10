'use client';

import type { ReactNode } from 'react';
import { useGroupEdits } from '@/components/group-edits/GroupEditsProvider';
import { GroupGridSkeleton } from '@/components/group-grid/GroupGridSkeleton';
import { GroupLayout } from '@/components/group-layout/GroupLayout';
import { GroupPrioritySkeleton } from '@/components/group-priority/GroupPrioritySkeleton';
import { GroupVaultSkeleton } from '@/components/group-vault/GroupVaultSkeleton';
import { groupBodyMode } from './group-body-mode';
import { PANEL_BOX } from './panel-box';

export interface GroupBodyContent { notice: ReactNode; gear: ReactNode; dungeons: ReactNode; vault: ReactNode; dungeonCount: number }

/**
 * The group page below the picker. It reads the membership asked for, which runs ahead of the server's render
 * during an edit, so the skeleton has one column per requested member. Both branches render GroupLayout at the
 * same place, so the selected phone tab survives an edit.
 */
export function GroupBody({ legend, empty, content }: { legend: ReactNode; empty: ReactNode; content: GroupBodyContent | null }) {
  const { keys, pending } = useGroupEdits();
  const mode = groupBodyMode(pending, keys.length, content !== null);
  if (mode === 'empty') return <>{empty}</>;
  const live = mode === 'content' ? content : null;
  return (
    <>
      {live?.notice ?? null}
      <GroupLayout
        dungeonCount={live ? live.dungeonCount : null}
        legend={legend}
        gear={live ? live.gear : <GroupGridSkeleton members={keys.length} />}
        dungeons={live ? live.dungeons : <div className={PANEL_BOX}><GroupPrioritySkeleton /></div>}
        vault={live ? live.vault : <div className={PANEL_BOX}><GroupVaultSkeleton /></div>}
      />
    </>
  );
}
