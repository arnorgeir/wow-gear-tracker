import { nameKeyOf } from '@/core/characters/name-key';
import type { Region } from '@/core/types';

/** The shape of an already-tracked character the bar needs to tell search results apart. */
export interface TrackedCharacter {
  region: Region;
  realmId: number;
  name: string;
}

/** A search result carries these two fields under different names than a tracked character does. */
interface Trackable {
  blizzardRealmId: number;
  name: string;
}

export type TrackedLookup = ReadonlySet<string>;

const keyOf = (region: Region, realmId: number, name: string) => `${region}:${realmId}:${nameKeyOf(name)}`;

/** Builds a lookup of (region, realm, name) keys from the characters already tracked. */
export function buildTrackedLookup(tracked: TrackedCharacter[]): TrackedLookup {
  return new Set(tracked.map((t) => keyOf(t.region, t.realmId, t.name)));
}

/** Whether a search result, found under `region`, is already tracked. */
export function isTracked(lookup: TrackedLookup, region: Region, result: Trackable): boolean {
  return lookup.has(keyOf(region, result.blizzardRealmId, result.name));
}
