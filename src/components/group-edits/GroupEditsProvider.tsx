'use client';

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { groupHref } from '@/core/characters/member-key';
import { createGroupEdits } from './group-edits';

interface GroupEdits {
  /** The membership asked for, which can be ahead of what the page shows while it loads. */
  keys: string[];
  /** True while a membership change is loading. */
  pending: boolean;
  add: (key: string) => void;
  remove: (key: string) => void;
}

const GroupEditsContext = createContext<GroupEdits | null>(null);

export function useGroupEdits(): GroupEdits {
  const edits = useContext(GroupEditsContext);
  if (!edits) throw new Error('useGroupEdits needs a GroupEditsProvider above it.');
  return edits;
}

/** One place that changes the group's membership, so every control edits the same list. */
export function GroupEditsProvider({ keys: committed, children }: { keys: string[]; children?: ReactNode }) {
  const router = useRouter();
  const [intent, setIntent] = useState(committed);
  const [pending, startTransition] = useTransition();
  const [edits] = useState(() => createGroupEdits(committed, (next) => {
    setIntent(next);
    startTransition(() => router.replace(groupHref(next)));
  }));

  // Once every navigation has finished, the rendered keys are the truth again.
  const committedKey = committed.join(',');
  useEffect(() => {
    if (!pending) edits.reset(committedKey ? committedKey.split(',') : []);
  }, [pending, committedKey, edits]);

  return (
    <GroupEditsContext.Provider value={{ keys: pending ? intent : committed, pending, add: edits.add, remove: edits.remove }}>
      {children}
    </GroupEditsContext.Provider>
  );
}
