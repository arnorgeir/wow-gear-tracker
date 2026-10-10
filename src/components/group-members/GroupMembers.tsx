'use client';

import { useState } from 'react';
import { AddCharacterBar } from '@/components/add-character-bar/AddCharacterBar';
import type { TrackedCharacter } from '@/components/add-character-bar/tracked';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { useGroupEdits } from '@/components/group-edits/GroupEditsProvider';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { classTextColor } from '@/components/shared/class-colors';
import { LABEL_CLASS } from '@/components/shared/field-classes';
import { GROUP_UPDATING } from '@/components/shared/loading-copy';
import { MAX_GROUP_SIZE } from '@/core/characters/member-key';
import type { Region } from '@/core/types';
import type { GroupMemberView } from '@/server/views/types';

interface Props {
  members: GroupMemberView[];
  region: Region | null;
  available: { key: string; label: string }[];
  tracked: TrackedCharacter[];
}

export function GroupMembers({ members, region, available, tracked }: Props) {
  const [open, setOpen] = useState(false);
  // Every edit goes through the shared membership, never through the keys this render was given.
  const { keys, pending, add } = useGroupEdits();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {members.map((m) => (
          <span key={m.key} className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5 pr-0.5">
            {m.character && <CharacterAvatar name={m.character.name} className={m.character.className} avatarUrl={m.character.avatarUrl} classIconUrl={m.character.classIconUrl} size={32} />}
            <span className="font-semibold" style={m.character ? { color: classTextColor(m.character.className) } : undefined}>{m.name}</span>
            {m.character && <span className="hidden text-sm text-muted sm:inline">{m.character.spec}</span>}
            <RemoveFromGroupButton memberKey={m.key} name={m.name} />
          </span>
        ))}
        {keys.length < MAX_GROUP_SIZE
          ? <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="h-12 rounded-full border border-line-strong bg-raised px-5 font-semibold">Add character</button>
          : <span className="text-sm text-muted">Group is full ({MAX_GROUP_SIZE})</span>}
        {/* Always mounted: screen readers skip a live region that arrives with its text. */}
        <span role="status" className="sr-only">{pending ? GROUP_UPDATING : ''}</span>
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
