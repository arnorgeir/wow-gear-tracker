'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface PendingCharacter { name: string | null; setName: (name: string | null) => void }

const PendingCharacterContext = createContext<PendingCharacter | null>(null);

/** The name being added from the bar, or null. Null outside a provider: the bar then shows its own line. */
export function usePendingCharacter(): PendingCharacter | null {
  return useContext(PendingCharacterContext);
}

export function PendingCharacterProvider({ children }: { children?: ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  return <PendingCharacterContext.Provider value={{ name, setName }}>{children}</PendingCharacterContext.Provider>;
}
