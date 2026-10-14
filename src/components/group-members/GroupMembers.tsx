'use client';

import { useState } from 'react';
import { AddCharacterBar } from '@/components/add-character-bar/AddCharacterBar';
import type { TrackedCharacter } from '@/components/add-character-bar/tracked';
import { useGroupEdits } from '@/components/group-edits/GroupEditsProvider';
import { LABEL_CLASS } from '@/components/shared/field-classes';
import { MAX_GROUP_SIZE } from '@/core/characters/member-key';
import type { Region } from '@/core/types';
import type { GroupMemberView } from '@/server/views/types';
import { MemberChip } from './MemberChip';
import { orderByKeys } from './order-by-keys';
import { statusText } from './status-text';
import { useMemberDrag } from './use-member-drag';

interface Props {
  members: GroupMemberView[];
  region: Region | null;
  available: { key: string; label: string }[];
  tracked: TrackedCharacter[];
}

export function GroupMembers({ members, region, available, tracked }: Props) {
  const [open, setOpen] = useState(false);
  // Every edit goes through the shared membership, never through the keys this render was given.
  const { keys, pending, add, move, moved } = useGroupEdits();
  const drag = useMemberDrag(keys, (key, index) => move(key, members.find((m) => m.key === key)?.name ?? '', index));
  const display = orderByKeys(members, drag.preview ?? keys);
  const picked = members.find((m) => m.key === drag.pickedKey) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex flex-wrap items-center gap-2 ${drag.draggingKey ? 'select-none' : ''}`}>
        {display.map((m, index) => (
          <MemberChip key={m.key} member={m} index={index} count={display.length} reorderable={display.length >= 2}
            lift={drag.draggingKey === m.key ? 'dragging' : drag.pickedKey === m.key ? 'picked' : 'none'}
            pickedName={picked?.name ?? null} rowDragging={drag.draggingKey !== null}
            handle={drag.handleEvents(m.key)} chipRef={drag.chipRef(m.key)} onKeyMove={(to) => move(m.key, m.name, to)} />
        ))}
        {keys.length < MAX_GROUP_SIZE
          ? <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="h-12 rounded-full border border-line-strong bg-raised px-5 font-semibold">Add character</button>
          : <span className="text-sm text-muted">Group is full ({MAX_GROUP_SIZE})</span>}
        {/* Always mounted: screen readers skip a live region that arrives with its text. */}
        <span role="status" className="sr-only">{statusText({ picked, moved, pending })}</span>
        <span id="group-move-hint" className="sr-only">Drag, or press to pick up. Arrow keys, Home and End also move it.</span>
      </div>
      {open && keys.length < MAX_GROUP_SIZE && (
        <div className="flex flex-col gap-3">
          {available.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="group-pick" className={LABEL_CLASS}>Tracked characters</label>
              <select id="group-pick" value="" onChange={(e) => e.target.value && add(e.target.value)}
                className="h-12 w-80 max-w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-ink">
                <option value="">Choose a character</option>
                {available.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
          )}
          <AddCharacterBar trackedCharacters={tracked} lockedRegion={region} onAdded={({ key }) => add(key)} />
        </div>
      )}
    </div>
  );
}
