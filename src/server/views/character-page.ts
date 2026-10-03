import { type SnapshotItemInput } from '@/core/db/queries/snapshots';
import { getCharacter } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { choosePriorityList } from '@/core/priority/list';
import { rankDungeons } from '@/core/priority/rank';
import { decodeTrack } from '@/core/raidbots/tracks';
import { ensureBisLists, ensureClassIcons, ensureItemIcons, ensureTracks } from '@/core/sync/reference-sync';
import { readSeason } from '@/core/sync/season-sync';
import { LIST_TYPES, type ListType, type SlotType } from '@/core/types';
import type { Services } from '../services';
import type { GearRowView, CharacterPageView } from './types';
import { loadGear, summarize, upgradeFor, crestView } from './summarize';
import { itemView } from './item-view';

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const gear = await loadGear(db, id);
  const summary = summarize(character, gear.current);
  const list = listType ?? character.priorityList;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [summary.spec])
    .catch(() => [summary.spec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const bis = await ensureBisLists({ db, source: bisSource, now: time }, summary.specSlug);
  const specs = await specsPromise;
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, character.region);
  const costs = crestCostsByGroup(tracks.values());

  const evaluate = (l: ListType) => evaluateGear({ equipped: gear.equipped, bisRows: bis.lists?.[l] ?? [], tracks, bagItemIds: gear.bagItemIds });
  const gearRows = evaluate(list);
  const vaultItems = gear.simc?.items.filter((i) => i.location === 'vault') ?? [];

  const season = await readSeason(db, time);
  const choice = choosePriorityList(bis.lists, character.priorityList);
  const priorityRows = choice.listType === list ? gearRows : evaluate(choice.listType);
  const ranks = rankDungeons(
    [{ id, name: character.name, className: character.className, rows: priorityRows, equipped: gear.equipped, tracks }],
    season.dungeons,
  );
  const creditItemIds = ranks.flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'item' ? [cr.itemId] : []))));

  const iconIds = [...gear.equipped.map((g) => g.itemId), ...gearRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : [])), ...vaultItems.map((i) => i.itemId), ...creditItemIds];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows: GearRowView[] = gearRows.map((r) => ({
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && itemView(r.equipped, icons, r.track),
    bis: r.row.kind === 'item'
      ? {
          kind: 'item' as const,
          ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
          isTier: r.row.isTier,
          isCatalyst: r.row.isCatalyst,
          source: r.row.source,
        }
      : { kind: 'any' as const, minItemLevel: r.row.minItemLevel, source: r.row.source },
    upgrade: upgradeFor(r, costs, gear.balances),
  }));

  const listRows = bis.lists?.[list] ?? [];
  const isBis = (item: SnapshotItemInput) => listRows.some((r) => r.kind === 'any'
    ? r.slots.includes(item.slot as SlotType) && (item.itemLevel ?? 0) >= r.minItemLevel
    : r.itemId === item.itemId || (r.isTier && item.isTier && r.slots.includes(item.slot as SlotType)));
  const vaultChoices = vaultItems.map((item) => ({ ...itemView(item, icons, decodeTrack(item.bonusIds, tracks)), isBis: isBis(item) }));

  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    classIconUrl: classIcons.get(character.className) ?? null,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    vaultChoices,
    vaultChoicesAt: gear.simc?.createdAt ?? null,
    crests: crestView(gear, costs),
    counts,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    tracksError,
    specs,
    priority: {
      listType: choice.listType,
      fellBack: choice.fellBack,
      season: season.status,
      needsSync: season.needsSync,
      approximate: tracksError !== null,
      dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
        challengeModeId: d.challengeModeId,
        name: d.name,
        score: d.score,
        split: d.split,
        credits: d.characters.flatMap((c) => c.credits).map((cr) => (cr.kind === 'item'
          ? { kind: 'item' as const, slotLabel: cr.slotLabel, weight: cr.weight,
              item: itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: 'EPIC', bonusIds: cr.bonusIds }, icons, null) }
          : cr)),
      })),
      nothingFrom: ranks.filter((d) => d.score === 0).map((d) => d.name),
    },
  };
}
