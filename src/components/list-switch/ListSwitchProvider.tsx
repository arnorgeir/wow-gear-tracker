'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ListType } from '@/core/types';

interface ListSwitch {
  /** The list asked for, which runs ahead of the rendered one while it loads. */
  listType: ListType;
  pending: boolean;
  select: (listType: ListType, href: string) => void;
}

const ListSwitchContext = createContext<ListSwitch | null>(null);

export function useListSwitch(): ListSwitch {
  const value = useContext(ListSwitchContext);
  if (!value) throw new Error('useListSwitch needs a ListSwitchProvider above it.');
  return value;
}

/** Owns a list-tab switch, so the sections that depend on the list can show skeletons while it loads. */
export function ListSwitchProvider({ listType: rendered, children }: { listType: ListType; children?: ReactNode }) {
  const router = useRouter();
  const [requested, setRequested] = useState(rendered);
  const [pending, startTransition] = useTransition();
  function select(listType: ListType, href: string) {
    setRequested(listType);
    // The transition's pending flag lasts until the new list has rendered.
    startTransition(() => router.push(href, { scroll: false }));
  }
  return <ListSwitchContext.Provider value={{ listType: pending ? requested : rendered, pending, select }}>{children}</ListSwitchContext.Provider>;
}
