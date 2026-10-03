import { createLimiter, fetchJson, isHttpError, type FetchFn, type SleepFn } from '../http';
import type { GearItem, Region } from '../types';
import {
  parseEquipment, parseProfile, parseItemInfo, parseKeystoneDungeon, parseJournalInstance,
  parseJournalInstanceIndex, parseJournalEncounter,
  type RawEquipment, type RawProfile, type RawItem, type RawKeystoneDungeon,
  type RawJournalInstance, type RawJournalInstanceIndex, type RawJournalEncounter,
} from './parse';
import { createTokenSource } from './token';
import type {
  CharacterProfile, CharacterRef, ItemInfo, JournalEncounter, JournalInstance, JournalInstanceRef,
  KeystoneDungeon, PlayableClass, Realm,
} from './types';

export interface BlizzardClient {
  getProfile(ref: CharacterRef): Promise<CharacterProfile>;
  getEquipment(ref: CharacterRef): Promise<GearItem[]>;
  getCharacterMedia(ref: CharacterRef): Promise<string | null>;
  getClassIconUrl(region: Region, classId: number): Promise<string | null>;
  getItemIconUrl(region: Region, itemId: number): Promise<string | null>;
  getItemDetails(region: Region, itemId: number): Promise<ItemInfo | null>;
  getRealms(region: Region): Promise<Realm[]>;
  getClasses(region: Region): Promise<PlayableClass[]>;
  getKeystoneDungeon(region: Region, challengeModeId: number): Promise<KeystoneDungeon>;
  getJournalInstances(region: Region): Promise<JournalInstanceRef[]>;
  getJournalInstance(region: Region, id: number): Promise<JournalInstance>;
  getJournalEncounter(region: Region, id: number): Promise<JournalEncounter>;
}

interface Options {
  clientId: string;
  clientSecret: string;
  fetchFn?: FetchFn;
  now?: () => number;
  sleep?: SleepFn;
}

type Namespace = 'profile' | 'static' | 'dynamic';

export function createBlizzardClient(options: Options): BlizzardClient {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const limit = createLimiter(4);
  const realmCache = new Map<Region, Promise<Realm[]>>();
  const classCache = new Map<Region, Promise<PlayableClass[]>>();
  const token = createTokenSource({ clientId: options.clientId, clientSecret: options.clientSecret, fetchFn, now });

  async function api<T>(region: Region, path: string, namespace: Namespace): Promise<T> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `https://${region}.api.blizzard.com${path}${separator}namespace=${namespace}-${region}&locale=en_GB`;
    const call = async () => fetchJson<T>(fetchFn, url, { headers: { Authorization: `Bearer ${await token.get()}` } }, options.sleep);
    return limit(async () => {
      try {
        return await call();
      } catch (err) {
        if (isHttpError(err) && err.status === 401) {
          token.invalidate();
          return call();
        }
        throw err;
      }
    });
  }

  const characterPath = (ref: CharacterRef) =>
    `/profile/wow/character/${ref.realmSlug}/${encodeURIComponent(ref.name.toLowerCase())}`;

  async function mediaAsset(region: Region, path: string, namespace: Namespace, key: string): Promise<string | null> {
    try {
      const media = await api<{ assets?: { key: string; value: string }[] }>(region, path, namespace);
      return media.assets?.find((asset) => asset.key === key)?.value ?? null;
    } catch (err) {
      if (isHttpError(err) && err.status === 404) return null;
      throw err;
    }
  }

  return {
    async getProfile(ref) {
      return parseProfile(await api<RawProfile>(ref.region, characterPath(ref), 'profile'));
    },

    async getEquipment(ref) {
      return parseEquipment(await api<RawEquipment>(ref.region, `${characterPath(ref)}/equipment`, 'profile'));
    },

    getCharacterMedia(ref) {
      return mediaAsset(ref.region, `${characterPath(ref)}/character-media`, 'profile', 'avatar');
    },

    getClassIconUrl(region, classId) {
      return mediaAsset(region, `/data/wow/media/playable-class/${classId}`, 'static', 'icon');
    },

    async getItemIconUrl(region, itemId) {
      try {
        const media = await api<{ assets?: { key: string; value: string }[] }>(region, `/data/wow/media/item/${itemId}`, 'static');
        return media.assets?.find((asset) => asset.key === 'icon')?.value ?? null;
      } catch (err) {
        if (isHttpError(err) && err.status === 404) return null;
        throw err;
      }
    },

    async getItemDetails(region, itemId) {
      try {
        return parseItemInfo(await api<RawItem>(region, `/data/wow/item/${itemId}`, 'static'));
      } catch (err) {
        if (isHttpError(err) && err.status === 404) return null;
        throw err;
      }
    },

    async getKeystoneDungeon(region, challengeModeId) {
      return parseKeystoneDungeon(await api<RawKeystoneDungeon>(region, `/data/wow/mythic-keystone/dungeon/${challengeModeId}`, 'dynamic'));
    },

    async getJournalInstances(region) {
      return parseJournalInstanceIndex(await api<RawJournalInstanceIndex>(region, '/data/wow/journal-instance/index', 'static'));
    },

    async getJournalInstance(region, id) {
      return parseJournalInstance(await api<RawJournalInstance>(region, `/data/wow/journal-instance/${id}`, 'static'));
    },

    async getJournalEncounter(region, id) {
      return parseJournalEncounter(await api<RawJournalEncounter>(region, `/data/wow/journal-encounter/${id}`, 'static'));
    },

    getRealms(region) {
      let cached = realmCache.get(region);
      if (!cached) {
        cached = api<{ realms: Realm[] }>(region, '/data/wow/realm/index', 'dynamic')
          .then((data) => data.realms.map(({ id, name, slug }) => ({ id, name, slug })));
        cached.catch(() => realmCache.delete(region));
        realmCache.set(region, cached);
      }
      return cached;
    },

    getClasses(region) {
      let cached = classCache.get(region);
      if (!cached) {
        cached = (async () => {
          const index = await api<{ classes: { id: number; name: string }[] }>(region, '/data/wow/playable-class/index', 'static');
          return Promise.all(index.classes.map(async (cls) => {
            const detail = await api<{ specializations?: { name: string }[] }>(region, `/data/wow/playable-class/${cls.id}`, 'static');
            return { id: cls.id, name: cls.name, specs: (detail.specializations ?? []).map((s) => s.name) };
          }));
        })();
        cached.catch(() => classCache.delete(region));
        classCache.set(region, cached);
      }
      return cached;
    },
  };
}
