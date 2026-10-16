import type { MemberKey } from '@/core/characters/member-key';
import { findCharacterByKey } from '@/core/db/queries/characters';
import { getSpec } from '@/core/db/queries/specs';
import { crestCostsByGroup } from '@/core/gear/crests';
import { rankDungeons } from '@/core/priority/rank';
import { ensureClassIcons, ensureItemIcons, readTracks } from '@/core/sync/reference-sync';
import { readSeason } from '@/core/sync/season-sync';
import type { Services } from '../services';
import type { CharacterPageView, UntrackedCharacterView } from './types';
import { createBisLookup, referenceDue } from './bis-lookup';
import { dungeonArt } from './dungeon-art';
import { crestView } from './summarize';
import { creditView, loadMember, priorityCharacter, rowView, vaultChoicesFor } from './member';

export async function getCharacterPage(services: Services, key: MemberKey): Promise<CharacterPageView | UntrackedCharacterView> {
  const { db, blizzard, now } = services;
  const character = await findCharacterByKey(db, key);
  if (!character) return { status: 'untracked', region: key.region, realmSlug: key.realmSlug, name: key.nameKey };
  const time = now();
  const fallbackSpec = character.specOverride || character.specName;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [fallbackSpec])
    .catch(() => [fallbackSpec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const tracksRead = await readTracks(db, time);
  const { tracks } = tracksRead;
  const tracksKnown = tracks.size > 0;
  const member = await loadMember({ db, tracks, bisFor: createBisLookup(db, time, services.currentAccountId()) }, character);
  const { summary, gear, bis, choice } = member;
  const specs = await specsPromise;
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, character.region);
  const costs = crestCostsByGroup(tracks.values());

  const gearRows = member.priorityRows;
  const season = await readSeason(db, time);
  const ranks = rankDungeons([priorityCharacter(member, tracks)], season.dungeons);
  const creditItemIds = ranks.flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'any' ? [] : [cr.itemId]))));

  const iconIds = [...gear.equipped.map((g) => g.itemId), ...gearRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : [])), ...member.vaultItems.map((i) => i.itemId), ...creditItemIds];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows = gearRows.map((r) => rowView(r, icons, costs, gear.balances, bis.targets));

  return {
    ...summary,
    classIconUrl: classIcons.get(character.className) ?? null,
    listType: choice.listType,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    vaultChoices: vaultChoicesFor(member.vaultItems, bis.lists?.[choice.listType] ?? [], icons, tracks),
    vaultChoicesAt: gear.simc?.createdAt ?? null,
    crests: crestView(gear, costs),
    editedCount: bis.editedCount,
    doneCount: rows.filter((r) => r.state === 'done').length,
    fellBackFrom: choice.fellBack ? bis.listType : null,
    bisSource: bis.source,
    specIconUrl: (await getSpec(db, summary.specSlug))?.iconUrl ?? classIcons.get(character.className) ?? null,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    bisLoading: bis.status === 'loading',
    tracksError: tracksRead.error,
    tracksKnown,
    tracksLoading: tracksRead.status === 'loading',
    referenceDue: referenceDue(tracksRead.due, [bis]),
    specs,
    priority: {
      listType: choice.listType,
      fellBackFrom: choice.fellBack ? bis.listType : null,
      source: bis.source,
      season: season.status,
      needsSync: season.needsSync,
      bisLoading: bis.status === 'loading',
      approximate: !tracksKnown,
      dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
        challengeModeId: d.challengeModeId,
        name: d.name,
        ...dungeonArt(season.dungeons, d.challengeModeId),
        score: d.score,
        split: d.split,
        credits: d.characters.flatMap((c) => c.credits).map((cr) => creditView(cr, icons)),
      })),
      nothingFrom: ranks.filter((d) => d.score === 0).map((d) => ({ challengeModeId: d.challengeModeId, name: d.name })),
    },
  };
}
