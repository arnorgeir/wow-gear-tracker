import { decodeGroupCookie, findByMemberKey, formatMemberKey, memberKeyOf, selectGroup, type MemberKey } from '@/core/characters/member-key';
import { listCharacters } from '@/core/db/queries/characters';
import { getClassIconMap } from '@/core/db/queries/media';
import { listSpecs } from '@/core/db/queries/specs';
import { bisMatches, needsByDrop } from '@/core/priority/drop-needs';
import { choosePriorityList } from '@/core/priority/list';
import { readTracks } from '@/core/sync/reference-sync';
import type { LootItem, Region } from '@/core/types';
import type { Services } from '../services';
import { createBisLookup } from './bis-lookup';
import { exclusionReason, memberState } from './group-grid';
import { loadMember, priorityCharacter } from './member';
import { specRows } from './settings-bis';
import { specIconOf } from './settings-shared';
import type { DungeonPageView, LootBisView, LootNeedView } from './types';

/** Which characters the dungeon page checks: everyone tracked, or the group the group page remembers. */
export interface LootLens { who?: 'all' | 'group'; groupCookie?: string }

export interface LootNeeds {
  needs: Map<number, LootNeedView[]>;
  bis: Map<number, LootBisView[]>;
  coverage: DungeonPageView['coverage'];
  lens: DungeonPageView['lens'];
}

/** Who needs each drop and which specs' stored lists name it. Database reads only, in sequence. */
export async function loadLootNeeds(services: Services, loot: LootItem[], lens: LootLens): Promise<LootNeeds> {
  const { db } = services;
  const time = services.now();
  const all = await listCharacters(db);
  const classIcons = await getClassIconMap(db);
  const { tracks } = await readTracks(db, time);
  const bisFor = createBisLookup(db, time, services.currentAccountId());

  const remembered = selectGroup(decodeGroupCookie(lens.groupCookie)).members;
  const groupRemembered = remembered.length > 0;
  const who = lens.who === 'group' && groupRemembered ? 'group' : 'all';
  const checked: { key: MemberKey; character: (typeof all)[number] | undefined }[] = who === 'group'
    ? remembered.map((key) => ({ key, character: findByMemberKey(all, key) }))
    : all.map((character) => ({ key: memberKeyOf(character), character }));

  // ponytail: loads every character in the lens, linear in the roster as the characters page does; cache when rosters grow.
  const excluded: { name: string; reason: string }[] = [];
  const evaluated: Awaited<ReturnType<typeof loadMember>>[] = [];
  for (const { key, character } of checked) {
    if (!character) { excluded.push({ name: key.nameKey, reason: exclusionReason('untracked', false)! }); continue; }
    const data = await loadMember({ db, tracks, bisFor }, character, classIcons);
    const reason = exclusionReason(memberState(character, data.gear.current != null), data.priorityRows.length > 0, data.bis.status === 'loading');
    if (reason) excluded.push({ name: character.name, reason });
    else evaluated.push(data);
  }

  const needs = new Map<number, LootNeedView[]>();
  const byId = new Map(evaluated.map((d) => [d.character.id, d]));
  for (const [itemId, list] of needsByDrop(evaluated.map((d) => priorityCharacter(d, tracks)), loot)) {
    needs.set(itemId, list.map((n) => {
      const { character, summary } = byId.get(n.characterId)!;
      return {
        key: formatMemberKey(memberKeyOf(character)), name: n.characterName, className: character.className,
        avatarUrl: summary.avatarUrl, classIconUrl: summary.classIconUrl,
        slotLabel: n.slotLabel, via: n.via, reason: n.reason, ...(n.via === 'catalyst' ? { fit: n.fit } : {}),
      };
    }));
  }

  const region: Region = all[0]?.region ?? 'eu';
  const bis = new Map<number, LootBisView[]>();
  const specs = specRows(await listSpecs(db), all).sort((a, b) => a.className.localeCompare(b.className) || a.specName.localeCompare(b.specName));
  for (const spec of specs) {
    const read = await bisFor(spec.methodSlug, region);
    if (!read.lists) continue;
    const rows = read.lists[choosePriorityList(read.lists, read.listType).listType];
    const view: LootBisView = { slug: spec.methodSlug, label: `${spec.specName} ${spec.className}`, className: spec.className, iconUrl: specIconOf(spec.iconUrl, spec.className, classIcons) };
    for (const itemId of bisMatches(rows, read.targets, read.statsMatter, spec.className, loot)) bis.set(itemId, [...(bis.get(itemId) ?? []), view]);
  }

  return { needs, bis, coverage: { evaluated: evaluated.length, excluded }, lens: { who, groupRemembered } };
}
