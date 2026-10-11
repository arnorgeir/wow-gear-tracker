import { characterHref } from '@/core/characters/member-key';
import type { CharacterRow } from '@/core/db/queries/characters';
import { methodSpecSlug } from '@/core/method/method';
import type { BisRead } from '@/core/sync/reference-sync';
import type { CharacterChipView, SpecFetchState } from './types';

export const trackedSlug = (c: CharacterRow) => methodSpecSlug(c.specOverride || c.specName, c.className);

/** What the picker and the editor say about a spec's Method list. A tracked spec always reads as tracked. */
export function fetchStateOf(read: BisRead, tracked: boolean): SpecFetchState {
  if (tracked) return { kind: 'tracked' };
  if (read.fetchedAt !== null) return { kind: 'fetched', at: read.fetchedAt };
  return read.status === 'failed' ? { kind: 'failed' } : { kind: 'notFetched' };
}

export const chipOf = (c: CharacterRow, classIcons: ReadonlyMap<string, string | null>): CharacterChipView =>
  ({ name: c.name, href: characterHref(c), className: c.className, avatarUrl: c.avatarUrl, classIconUrl: classIcons.get(c.className) ?? null });

/** The spec's own icon, else its class icon. */
export const specIconOf = (iconUrl: string | null | undefined, className: string, classIcons: ReadonlyMap<string, string | null>) =>
  iconUrl ?? classIcons.get(className) ?? null;
