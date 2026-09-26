import { createLimiter, fetchJson, HttpError, REQUEST_TIMEOUT_MS, type FetchFn, type SleepFn } from '../http';
import { SLOT_TYPES, type Faction, type GearItem, type Quality, type Region, type SlotType } from '../types';

export interface CharacterRef { region: Region; realmSlug: string; name: string }
export interface CharacterProfile {
  name: string;
  realmId: number;
  realmSlug: string;
  realmName: string;
  className: string;
  specName: string;
  raceName: string;
  faction: Faction | null;
}
export interface Realm { id: number; name: string; slug: string }
export interface PlayableClass { id: number; name: string; specs: string[] }

export interface ItemDetails { quality: Quality | null; isTier: boolean }

export interface BlizzardClient {
  getProfile(ref: CharacterRef): Promise<CharacterProfile>;
  getEquipment(ref: CharacterRef): Promise<GearItem[]>;
  getCharacterMedia(ref: CharacterRef): Promise<string | null>;
  getClassIconUrl(region: Region, classId: number): Promise<string | null>;
  getItemIconUrl(region: Region, itemId: number): Promise<string | null>;
  getItemDetails(region: Region, itemId: number): Promise<ItemDetails | null>;
  getRealms(region: Region): Promise<Realm[]>;
  getClasses(region: Region): Promise<PlayableClass[]>;
}

interface Options {
  clientId: string;
  clientSecret: string;
  fetchFn?: FetchFn;
  now?: () => number;
  sleep?: SleepFn;
}

interface RawEquipment {
  equipped_items?: {
    slot: { type: string };
    item: { id: number };
    name: string;
    level?: { value: number };
    quality?: { type: string };
    bonus_list?: number[];
    set?: unknown;
  }[];
}

interface RawProfile {
  name: string;
  realm: { id: number; name: string; slug: string };
  character_class: { name: string };
  active_spec?: { name: string };
  race?: { name: string };
  faction?: { type: string };
}

const GEAR_SLOTS = new Set<string>(SLOT_TYPES);
type Namespace = 'profile' | 'static' | 'dynamic';

export function createBlizzardClient(options: Options): BlizzardClient {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const limit = createLimiter(4);
  const realmCache = new Map<Region, Promise<Realm[]>>();
  const classCache = new Map<Region, Promise<PlayableClass[]>>();
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > now() + 60_000) return token.value;
    const url = 'https://oauth.battle.net/token';
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new HttpError(res.status, url, await res.text());
    const data = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: now() + data.expires_in * 1000 };
    return token.value;
  }

  async function api<T>(region: Region, path: string, namespace: Namespace): Promise<T> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `https://${region}.api.blizzard.com${path}${separator}namespace=${namespace}-${region}&locale=en_GB`;
    const call = async () => fetchJson<T>(fetchFn, url, { headers: { Authorization: `Bearer ${await getToken()}` } }, options.sleep);
    return limit(async () => {
      try {
        return await call();
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          token = null;
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
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  }

  return {
    async getProfile(ref) {
      const raw = await api<RawProfile>(ref.region, characterPath(ref), 'profile');
      return {
        name: raw.name,
        realmId: raw.realm.id,
        realmSlug: raw.realm.slug,
        realmName: raw.realm.name,
        className: raw.character_class.name,
        specName: raw.active_spec?.name ?? '',
        raceName: raw.race?.name ?? '',
        faction: raw.faction?.type === 'HORDE' || raw.faction?.type === 'ALLIANCE' ? raw.faction.type : null,
      };
    },

    async getEquipment(ref) {
      const raw = await api<RawEquipment>(ref.region, `${characterPath(ref)}/equipment`, 'profile');
      return (raw.equipped_items ?? [])
        .filter((item) => GEAR_SLOTS.has(item.slot.type))
        .map((item) => ({
          slot: item.slot.type as SlotType,
          itemId: item.item.id,
          name: item.name,
          itemLevel: item.level?.value ?? null,
          quality: (item.quality?.type ?? 'COMMON') as Quality,
          bonusIds: item.bonus_list ?? [],
          isTier: Boolean(item.set),
        }));
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
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },

    async getItemDetails(region, itemId) {
      try {
        const item = await api<{ quality?: { type: string }; preview_item?: { set?: unknown } }>(region, `/data/wow/item/${itemId}`, 'static');
        return { quality: (item.quality?.type as Quality | undefined) ?? null, isTier: Boolean(item.preview_item?.set) };
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
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
