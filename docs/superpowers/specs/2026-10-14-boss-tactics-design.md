# Boss tactics from the dungeon journal

Status: written for the unattended loop on 2026-10-14; the owner reviews it with the pull request. Spec review round 1 (Opus reviewer; Codex was out of usage) folded in: S1.1 overview needs body text; S1.2 consecutive bullets form one list; S1.3 `h3` under the boss `h2`; S1.4 `encounters` optional on `SeasonData`; S1.5 spell names match exactly, then case-insensitively, then without a plural "s"; S1.6 an empty row gives no tactics; S1.7 mid-season journal fixes accepted as not reaching installs; S1.8 cache rule names the new table; S1.9 encounter IDs come from loot rows; S1.10 malformed nodes guarded.
Date: 2026-10-14
Issues: #155 (part of #45)
Builds on: PR #156 (`feat/dungeon-bosses-loot`, #5), which adds the dungeon page this spec extends. This branch starts from it and rebases onto `main` once #156 merges.

## Goal

Each boss on the dungeon page shows its tactics from Blizzard's in-game journal: the boss description, the overview, the tank, healer and damage dealer tips, and the ability list. Ability text comes from Wowhead tooltips. Nothing is copied from guide sites.

## What the journal gives

Checked live on 2026-10-14 (`/data/wow/journal-encounter/<id>`, Voidscar Arena and Kings' Rest). Each encounter has:

- `description`: a short lore paragraph.
- `sections`: a tree. The first top-level section is the Overview: its `body_text` is the overview, and its child sections are the role tips (titles "Damage Dealers", "Healers", "Tanks", in that order). The other top-level sections are abilities. An ability node has a `title`, often a `spell: { id, name }`, sometimes a `body_text`, and sometimes child sections. A node without a spell can group others (an add's name, such as "Ethereal Shade", holding its abilities).
- `body_text` markup: lines joined by `\r\n`, a blank line between paragraphs, `$bullet;` at the start of a bulleted line, and `[Spell Name]` naming an ability.
- Duplicates: the same ability can appear twice as sibling nodes with different section IDs and no difficulty flag ("Umbral Rupture" with its "Void Fissure" child, twice).
- No ability text: `/data/wow/spell/<id>` returns 404 for boss spells. Wowhead's tooltip script shows the text for a link with `data-wowhead="spell=<id>"`.

## Decisions

**Store at season sync, not on demand.** The season sync already fetches every encounter of the season (`loadSeasonLoot` in `src/core/sync/season-sync.ts`) and throws everything but the items away. Keeping the description and the section tree costs no extra request. Fetching per page visit would add one Blizzard call per boss on every view and a failure mode to the page. The cost is a new table and a `SEASON_META_KEY` bump, so existing installs reload the season once.

**Store the cleaned tree, parse the markup when loading the page.** The sync stores the section tree with duplicates removed and markup left as text. Turning markup into paragraphs, bullets and spell links happens in a pure function the loader calls. A change to how markup renders then needs no cache bump.

**Tactics sit in a collapsed disclosure per boss.** Loot stays the first thing under each boss name; a native `<details>` labeled "Tactics" holds the rest. A boss with no tactics stored shows no disclosure.

**Journal text refreshes with the season, not mid-season.** A same-season check only refreshes artwork (`runSync` in `season-sync.ts`), so a journal correction Blizzard ships mid-season reaches an install at the next season or the next `SEASON_META_KEY` bump. Accepted: journal text rarely changes within a season.

**Out of scope:** creature renders (`creature_display` media), role icons, difficulty-specific text, links to guide sites (#47), and any boss text not in the journal.

## Data

New table in `src/core/db/schema.ts`, then `npm run db:generate -- --name dungeon_encounters`:

```ts
/** Each season boss's journal text. Split dungeon halves share their encounters, so it keys on encounter alone. */
export const dungeonEncounters = sqliteTable('dungeon_encounters', {
  encounterId: integer('encounter_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /** JSON `JournalSection[]`: the cleaned section tree, markup left as text. */
  sections: text('sections').notNull(),
});
```

`JournalSection` (in `src/core/types.ts`): `{ title: string; spellId: number | null; bodyText: string | null; sections: JournalSection[] }`.

- **Parsing** (`src/core/blizzard/parse.ts`): `RawJournalEncounter` gains `description?` and `sections?`. `parseJournalEncounter` returns `description: string | null` and `sections: JournalSection[]`, built recursively. Among siblings, a node whose `title` and `spellId` match an earlier sibling's is dropped, children included. An empty or missing `body_text` is null. A node with no string `title` is skipped with its children; a `spell` without a numeric `id` gives `spellId: null`.
- **Sync** (`season-sync.ts`): `SeasonData` gains optional `encounters?: { encounterId; name; description; sections }[]`, one per distinct encounter; `loadSeasonLoot` always fills it, and test fixtures that build `SeasonData` by hand can leave it out. `replaceSeason` deletes and inserts `dungeon_encounters` in the same transaction as the other two tables. `SEASON_META_KEY` goes to `season.v6`; its comment and the `AGENTS.md` cache-version rule both name `dungeon_encounters`, and the test asserting `season.v5` moves to `v6`.
- **Query** (`season.ts`): `getSeasonDungeon` also returns `encounters: Map<number, { description; sections }>` for the encounter IDs in the dungeon's loot rows. Loot rows are the only link from a dungeon to its encounters, so a boss that drops nothing has no section on the page, as today. A stored row whose `sections` JSON doesn't parse counts as missing.

## Markup

`src/core/journal/markup.ts`, a pure function:

```ts
export type JournalInline = { text: string } | { spell: string; spellId: number | null };
export type JournalBlock = { kind: 'paragraph'; parts: JournalInline[] } | { kind: 'list'; items: JournalInline[][] };
export function parseJournalText(text: string, spells: ReadonlyMap<string, number>): JournalBlock[]
export function spellIndex(sections: JournalSection[]): Map<string, number>
```

- Splits on `\r\n` or `\n`. A line starting with `$bullet;` is a bullet, with the token removed; consecutive bullets form one `list` block. Other non-empty lines are paragraphs. Blank lines are dropped.
- `spellIndex` maps each node's `title` to its `spellId` across the whole tree, first ID winning, skipping nodes without one.
- `[Name]` becomes a spell part. Its `spellId` is looked up exactly, then case-insensitively, then with a trailing "s" removed (the journal writes "[Void Fissures]" for the "Void Fissure" node), else null.
- Any other `$token;` (letters only, ending in `;`) is removed, so stray markup never shows.
- Text is never treated as HTML: the component renders parts as text nodes.

## View and page

`DungeonBossView` gains `tactics: BossTacticsView | null`:

```ts
interface BossTacticsView {
  description: string | null;
  overview: JournalBlock[];
  roles: { title: string; blocks: JournalBlock[] }[];   // journal order and titles
  abilities: AbilityView[];
}
interface AbilityView { name: string; spellId: number | null; blocks: JournalBlock[]; abilities: AbilityView[] }
```

- The loader takes the first top-level section as the overview when it has no `spellId` and has `bodyText`; its children become `roles`. Otherwise there's no overview and every top-level section is an ability (an add's name with no text groups its abilities).
- `tactics` is null when the encounter has no stored row, or its row has neither a description nor sections.

`src/components/dungeon-page/BossTactics.tsx` (inside the dungeon page's directory, only `DungeonPage` renders it):

- `<details>` with summary "Tactics", closed by default, styled like the other disclosures (`border-line-strong bg-raised`, `focus-visible` ring).
- Description in muted text, then the overview blocks, then each role as an `h3` with its title and its blocks, then "Abilities" as an `h3` and a nested list.
- A `list` block renders as a `<ul>` of `<li>`, a paragraph as `<p>`. A spell part with an ID is a link to `https://www.wowhead.com/spell=<id>` with `data-wowhead="spell=<id>"`, `target="_blank"` and `rel="noreferrer"`; without an ID it is bold text.
- An ability with a `spellId` is the same kind of link; without one it is plain text heading its child list.

## Testing

- `parse.test.ts`: description and section tree kept; sibling duplicates (same title and spell) dropped with their children; empty `body_text` becomes null; a node without a title is skipped; a spell without a numeric ID gives null. Fixture uses made-up boss text in the journal's shape.
- `markup.test.ts`: consecutive bullets form one list, paragraphs between them split lists, blank lines dropped, `[Name]` with an exact, a case-different, a plural and an unknown name, `spellIndex` first ID wins, unknown `$token;` removed, `\n` and `\r\n` both split.
- `season-sync.test.ts`: a synced season stores one `dungeon_encounters` row per distinct encounter, shared by split halves; a resync replaces them.
- `season` query test: `getSeasonDungeon` returns the dungeon's encounters, and treats malformed JSON as missing.
- `dungeon-page.test.ts`: overview and roles split out, abilities nested, a first section without text is an ability group, `tactics` null without a row or with an empty row.
- `BossTactics` markup test: closed `<details>` with "Tactics", role headings, spell links with `data-wowhead="spell=<id>"`, an unknown spell as bold text, no disclosure when `tactics` is null (in the `DungeonPage` test).
- Gate: typecheck, lint, test and build.
- By hand on a DB copy: resync the season, open two dungeons, check tactics read cleanly with no `$` or `[` left, Wowhead spell tooltips appear, and the duplicate "Umbral Rupture" shows once.
