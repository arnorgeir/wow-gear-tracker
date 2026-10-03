import { getCharacter } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import type { GearRow } from '@/core/gear/evaluate';
import { rankDungeons } from '@/core/priority/rank';
import { ensureBisLists, ensureClassIcons, ensureItemIcons, ensureTracks } from '@/core/sync/reference-sync';
import { readSeason } from '@/core/sync/season-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { Services } from '../services';
import type { CharacterPageView } from './types';
import { crestView } from './summarize';
import { creditView, loadMember, priorityCharacter, rowView, vaultChoicesFor } from './member';

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const list = listType ?? character.priorityList;
  const fallbackSpec = character.specOverride || character.specName;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [fallbackSpec])
    .catch(() => [fallbackSpec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const member = await loadMember({ db, tracks, bisFor: (slug) => ensureBisLists({ db, source: bisSource, now: time }, slug) }, character);
  const { summary, gear, bis, choice } = member;
  const specs = await specsPromise;
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, character.region);
  const costs = crestCostsByGroup(tracks.values());

  const gearRows = list === choice.listType ? member.priorityRows : member.evaluate(list);
  const season = await readSeason(db, time);
  const ranks = rankDungeons([priorityCharacter(member, tracks)], season.dungeons);
  const creditItemIds = ranks.flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'item' ? [cr.itemId] : []))));

  const iconIds = [...gear.equipped.map((g) => g.itemId), ...gearRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : [])), ...member.vaultItems.map((i) => i.itemId), ...creditItemIds];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows = gearRows.map((r) => rowView(r, icons, costs, gear.balances));
  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : member.evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    classIconUrl: classIcons.get(character.className) ?? null,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    vaultChoices: vaultChoicesFor(member.vaultItems, bis.lists?.[list] ?? [], icons, tracks),
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
        credits: d.characters.flatMap((c) => c.credits).map((cr) => creditView(cr, icons)),
      })),
      nothingFrom: ranks.filter((d) => d.score === 0).map((d) => d.name),
    },
  };
}
