import { findByMemberKey, formatMemberKey, memberKeyOf, selectGroup, type MemberKey } from '@/core/characters/member-key';
import { listCharacters, type CharacterRow } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { rankDungeons } from '@/core/priority/rank';
import { isStale } from '@/core/sync/character-sync';
import { ensureBisLists, ensureClassIcons, ensureItemIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import { readSeason } from '@/core/sync/season-sync';
import type { Services } from '../services';
import { alignGrid, exclusionReason, memberState } from './group-grid';
import { dungeonArt } from './dungeon-art';
import { creditView, loadMember, priorityCharacter, rowView, vaultChoicesFor, type MemberData } from './member';
import { crestView } from './summarize';
import type { GroupMemberView, GroupPageView } from './types';

interface Loaded { character: CharacterRow | null; data: MemberData | null; view: GroupMemberView; reason: string | null }

export async function getGroupPage(services: Services, keys: MemberKey[]): Promise<GroupPageView> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const time = now();
  const { members: selected, dropped } = selectGroup(keys);
  const region = selected[0]?.region ?? null;

  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const costs = crestCostsByGroup(tracks.values());
  const all = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, region ?? 'eu');
  const bisBySlug = new Map<string, BisResult>();
  // ponytail: one Method request per distinct spec, in sequence; parallel needs reads kept apart from the cache writes.
  const bisFor = async (slug: string) => {
    if (!bisBySlug.has(slug)) bisBySlug.set(slug, await ensureBisLists({ db, source: bisSource, now: time }, slug));
    return bisBySlug.get(slug)!;
  };

  const loaded: Loaded[] = [];
  for (const key of selected) {
    const character = findByMemberKey(all, key) ?? null;
    const data = character ? await loadMember({ db, tracks, bisFor }, character, classIcons) : null;
    const state = memberState(character, data?.gear.current != null);
    const hasRows = (data?.priorityRows.length ?? 0) > 0;
    loaded.push({
      character, data,
      reason: exclusionReason(state, hasRows),
      view: {
        key: formatMemberKey(key),
        name: character?.name ?? key.nameKey,
        realmSlug: key.realmSlug,
        character: data?.summary ?? null,
        state,
        syncError: character?.lastSyncError ?? null,
        bisError: data?.bis.error ?? null,
        hasRows,
        listType: data?.choice.listType ?? 'mythicPlus',
        fellBack: data?.choice.fellBack ?? false,
        crests: data ? crestView(data.gear, costs) : null,
      },
    });
  }

  const eligible = loaded.filter((l) => l.reason === null && l.data);
  const season = await readSeason(db, time);
  const ranks = eligible.length > 0 ? rankDungeons(eligible.map((l) => priorityCharacter(l.data!, tracks)), season.dungeons) : null;

  const iconIds = loaded.flatMap(({ data }) => (data ? [
    ...data.gear.equipped.map((g) => g.itemId),
    ...data.priorityRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : [])),
    ...data.vaultItems.map((i) => i.itemId),
  ] : []));
  const creditIds = (ranks ?? []).flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'item' ? [cr.itemId] : []))));
  const icons = await ensureItemIcons({ db, blizzard, now: time }, region ?? 'eu', [...iconIds, ...creditIds]);

  const byId = new Map(eligible.map((l) => [l.character!.id, l]));
  const selectedKeys = new Set(selected.map(formatMemberKey));

  return {
    region,
    keys: loaded.map((l) => l.view.key),
    members: loaded.map((l) => l.view),
    grid: alignGrid(loaded.map(({ data, view }) => (data && view.state === 'ready' && view.hasRows
      ? data.priorityRows.map((r) => rowView(r, icons, costs, data.gear.balances))
      : null))),
    tracksKnown: tracksError === null,
    priority: {
      season: season.status,
      approximate: tracksError !== null,
      covered: eligible.map((l) => l.view.name),
      excluded: loaded.filter((l) => l.reason !== null).map((l) => ({ name: l.view.name, reason: l.reason! })),
      fellBack: eligible.filter((l) => l.view.fellBack).map((l) => l.view.name),
      ranking: ranks && {
        dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
          challengeModeId: d.challengeModeId,
          name: d.name,
          ...dungeonArt(season.dungeons, d.challengeModeId),
          score: d.score,
          split: d.split,
          members: d.characters.map((c) => {
            const { view } = byId.get(c.characterId)!;
            return {
              key: view.key, name: view.name, className: view.character!.className,
              avatarUrl: view.character!.avatarUrl, classIconUrl: view.character!.classIconUrl,
              credits: c.credits.map((cr) => creditView(cr, icons)),
            };
          }),
        })),
        nothingFrom: ranks.filter((d) => d.score === 0).map((d) => d.name),
      },
    },
    needsSeasonSync: region !== null && season.needsSync,
    vault: loaded.flatMap(({ data, view }) => (data ? [{
      key: view.key,
      name: view.name,
      pastedAt: data.gear.simc?.createdAt ?? null,
      choices: vaultChoicesFor(data.vaultItems, data.bis.lists?.[data.choice.listType] ?? [], icons, tracks),
    }] : [])),
    dropped: dropped.map((k) => ({ name: findByMemberKey(all, k)?.name ?? k.nameKey, region: k.region })),
    available: all
      .filter((c) => (region === null || c.region === region) && !selectedKeys.has(formatMemberKey(memberKeyOf(c))))
      .map((c) => ({ key: formatMemberKey(memberKeyOf(c)), label: `${c.name} – ${c.realmName} (${c.specOverride || c.specName})` })),
    tracked: all.map((c) => ({ region: c.region, realmId: c.realmId, name: c.name })),
    staleIds: loaded.flatMap(({ character }) => (character && character.status === 'ok' && isStale(character.lastSyncedAt, time) ? [character.id] : [])),
  };
}
