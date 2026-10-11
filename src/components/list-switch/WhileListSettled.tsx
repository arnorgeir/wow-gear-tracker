'use client';

import type { ReactNode } from 'react';
import { useListSwitch } from './ListSwitchProvider';

/** Shows `fallback` while a list switch is loading. */
export function WhileListSettled({ fallback, children }: { fallback: ReactNode; children?: ReactNode }) {
  return <>{useListSwitch().pending ? fallback : children}</>;
}
