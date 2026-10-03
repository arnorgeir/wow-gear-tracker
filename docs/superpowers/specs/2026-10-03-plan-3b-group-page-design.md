# Plan 3b: group page

Status: awaiting approval
Date: 2026-10-03
Issue: #44
Parent specs: `docs/superpowers/specs/2026-09-26-gear-tracker-design.md`, `docs/superpowers/specs/2026-09-30-plan-3a-dungeon-priority-design.md`
Design: the Group artboard on the design canvas

## Why

Plan 3a ranks the season's Mythic+ dungeons for one character. The question a group asks before key night is different: which dungeons should we run together, and who gets what from each? The scoring engine in `src/core/priority` already takes several characters. This spec adds the page that feeds it a group.

## What success looks like

- Open the group page and see, on one screen, each member's gear by slot, the season's dungeons ranked for the whole group, who needs what from each, and each member's Great Vault choices.
- The group is remembered in the browser, so the nav link reopens it.
- A link with characters' identities in it opens the same group on any install, and a character that install doesn't track yet can be tracked with one click.
- Members can be added from tracked characters or by search without leaving the page, up to five, all from one region.
- A member whose sync is running, failed, or found nothing never blanks the page or hides the other members.

## Non-goals

- Saved, named groups in the database. They wait for login (#49, #50), where groups belong to a user.
- Moving the Method and Raidbots refreshes off the render path. This spec adds a failure backoff instead (decision 6); the full move becomes its own issue.
- Class-colored names (#24). It touches the character cards too and stays its own issue.
- Browser tests (#35). The gaps are listed under Testing.
- New scoring rules. The ranking is `rankDungeons` as 3a shipped it.

## Decisions

### 1. Members are named by identity, not database ID

The URL is the source of truth: `/group?chars=eu.argent-dawn.birkibjorn,eu.argent-dawn.hrafnhildur`.

- **A member key** is `<region>.<realm slug>.<name key>`, where the name key comes from `nameKeyOf`. Realm slugs use letters, digits and hyphens, and character names only letters, so `.` is a safe separator. The browser shows `ö` as typed and percent-encodes it on the wire.
- **Why not database IDs:** an ID means nothing on another install, and a deleted character leaves nothing to search with. An identity key survives both. It also means a group page can be opened from a hand-typed URL.
- **Lookup:** a new query in `src/core/db/queries/characters.ts` finds tracked characters by `(region, realmSlug, nameKey)`. Slugs are unique within a region.
- **Parsing** lives in a plain module and is unit tested. Keys that don't parse are dropped, duplicates are dropped, and only the first five are kept. Name matching is case-insensitive through `nameKeyOf`, so `Birkibjörn` and `birkibjörn` are the same member.

### 2. Remembering the last group

- **A `group` cookie** holds the same comma-separated key list as the URL.
- **A client component**, `remember-group/RememberGroup.tsx`, writes it with `document.cookie` (`path=/`, a one-year `max-age`, `SameSite=Lax`) whenever the rendered member list changes. This covers membership edits and opening a link.
- **`/group` without a `chars` parameter** reads the cookie with `cookies()` and, when it holds keys, redirects to `/group?chars=…`. Without a cookie it renders the empty group.
- **`/group?chars=` (present but empty)** renders the empty group and does not redirect. Removing the last member lands here, and the cookie becomes empty, so the nav link doesn't bounce back to the old group.
- The choice between redirecting and rendering is a plain function of the parameter and the cookie, in `group-page-params.ts` under `src/server/views/`, with unit tests.

A cookie rather than `localStorage`: the server can read it, so the nav link opens the group with no empty-page flash and no client-side restore step. Like `localStorage`, it lives only in this browser and is replaced by per-user storage when login lands.

### 3. One region per group

Characters from different regions can't play together, so a group has one region: the region of its first member.

- **The URL:** keys from another region are dropped, with a note naming them: "Hrafnhildur (US) dropped: group members must share a region." The loader enforces this, not only the UI.
- **The tracked dropdown** lists only characters in the group's region.
- **The search** has its region select locked to the group's region while the group has members. An empty group can pick any region.

### 4. Editing the group

There is no group route handler. Membership is the URL.

- **Remove:** each member chip has a remove button. The client builds the new key list and calls `router.replace('/group?chars=…')`.
- **Add from tracked characters:** a `<select>` of tracked characters in the group's region that aren't in the group, labelled "Name – Realm (Spec)". Picking one adds it straight away.
- **Add by search:** the existing character search. Picking a result calls the existing `POST /api/characters`, which tracks the character or returns the one already tracked, then adds its key to the URL. The page stays on the group, unlike the Characters page, which navigates to the new character.
- **The cap:** the "Add character" control shows only while the group has fewer than five members. At five it is replaced by a muted "Group is full (5)".
- **Key arithmetic** (add, ignore a duplicate, respect the cap, remove, serialize) is a plain module, `group-members/member-keys.ts`, with unit tests.

### 5. Member states

`StaleSync` already syncs every member whose last sync is over five minutes old or never happened, then refreshes the page. The group page passes it the stale members' IDs. Each column then shows one of these:

| Member | Column shows |
|---|---|
| In sync | Gear, normally |
| Not tracked on this install | Header with the key's name and realm, "Not tracked", and a **Track** button. Track calls `POST /api/characters` with the realm slug, then refreshes. Nothing is fetched from Blizzard until the button is pressed |
| Track failed (Blizzard can't find it, or a typo) | The error message from the route, and **Remove from group** |
| Never synced, sync running | Dimmed cells reading "Syncing…" |
| Older gear, sync running | The older gear at full opacity, as the character page does today |
| Sync failed, older gear exists | The older gear, a header flag such as "Couldn't sync: Blizzard returned 503", and the existing `RefreshButton` |
| Sync failed, no gear | Dimmed cells, the same flag and `RefreshButton` |
| `notFound` | Dimmed cells, "Blizzard can't find this character", and **Remove from group** |
| No BiS list for the spec (Method answered 404 or is down, nothing cached) | Cells reading "No BiS list", and the BiS error in the header |

Dimming always comes with words beside it, never opacity alone. Members without evaluated rows (not tracked, no gear, no BiS list) are left out of the ranking, and the priority section says who was left out.

### 6. A failure backoff for `ensureBisLists`

Every page refreshes Method's BiS lists during the render when they are a day old. Unlike `ensureTracks`, `ensureBisLists` has no backoff: while Method is down, every page load waits for the request to fail, up to ten seconds. A group page with five specs makes this worse.

- **On failure** it records `bis.<spec slug>.failedAt` in `meta`, and skips refetching that spec for one hour, serving the cached list with its error. This matches `ensureTracks`.
- **Cold cache cost** stays: the first load of the day may wait a second or two for Method. That is acceptable for a local app. The full move off the render path gets its own issue, to be done before hosting (#8).

### 7. The loader

`src/server/views/group-page.ts` exports `getGroupPage(services, keys): GroupPageView`. The page passes it the parsed keys and renders the result.

1. `ensureTracks` once, and `listCharacters` once for both the members and the dropdown.
2. Resolve each key to a tracked character, or mark it untracked. Apply the region rule.
3. For each tracked member, in sequence for database work: load gear, ensure BiS lists (fetches deduped by spec slug, as `getCharacterCards` does), choose the priority list with the Overall fallback, and evaluate the rows. Each member uses its own priority list setting, as on the character page.
4. `readSeason`, then `rankDungeons` over the members that have rows.
5. `ensureItemIcons` once, for every item ID across the members, their BiS rows, vault choices and credits.
6. Align the grid: rows in canonical slot order, keyed by slot label and occurrence (Ring 1, Ring 2, Trinket 1, Trinket 2). A member with no row for a slot, such as an Off Hand under a two-hander, gets an empty cell.

**`GroupPageView`** carries:

- `region`, or null for an empty group.
- `members`: each member's key, state from decision 5, summary when tracked, crests, the list used and whether it fell back, and the BiS error.
- `grid`: rows of `{ slotLabel, cells }`, where a cell is a `GearRowView` or null.
- `priority`: the season status, the approximate flag, ranked dungeons with credits grouped per member (avatar, name, credits), the dungeons nobody needs anything from, and the members left out.
- `vault`: each member's vault choices with their BiS flag, and the paste time.
- `dropped`: keys removed by the region rule, for the note.
- `available`: tracked characters in the group's region that aren't members, for the dropdown.
- `staleIds`: member IDs for `StaleSync`.

**A targeted extraction.** Steps 3 and 5 for one character, and the vault "is it BiS" check, live inside `getCharacterPage` today. They move to `src/server/views/member.ts` (`loadMember`, `vaultChoicesFor`) and both loaders call them. The character page's output doesn't change, and its existing view tests guard that.

### 8. The page

`src/app/group/page.tsx` stays thin: it applies decision 2, calls `getGroupPage`, and renders. Like the other pages, it shows `SetupNotice` when configuration is missing.

Top to bottom, inside the same `max-w-[1440px]` frame as the other pages:

1. **Header:** an `h1` reading "Group", then the member chips and the add control.
2. **Legend:** the same state swatches as the Characters page, with words beside each.
3. **The gear grid**, full width.
4. **Dungeon priority** and **Great Vault**, side by side from the `lg` breakpoint, stacked below it.

**Empty group:** "Pick up to five characters to compare their gear and rank dungeons for the group.", the add control, and no grid.

**New components,** each in its own directory:

- **`group-members/GroupMembers.tsx`** (client). Chips with avatar, name, spec and a remove button labelled "Remove <name> from group". The add control opens a panel with the tracked dropdown above the search. It shows "Adding <name>…" while busy and an error line on failure, as `AddCharacterBar` does.
- **`group-grid/GroupGrid.tsx`** (server). A CSS grid of a 110 px slot column plus `repeat(n, minmax(220px, 1fr))`. The wrapper scrolls sideways when the members don't fit, and the slot column is sticky on the left with the surface background. Each member's header cell holds the avatar, the name linking to `/characters/{id}`, the list used ("Mythic+", or "Overall, Method has no Mythic+ list"), the crest summary or "Crests unknown" with a link to paste SimC on the character page, and the flags and buttons from decision 5.
- **`group-grid/GroupCell.tsx`**, rendered only by the grid. The equipped `ItemCard` with track and item level, the `StateBadge`, the `UpgradeBadge` when an upgrade is affordable, and a "Need:" line when the BiS item isn't equipped: the BiS item's name, "tier via catalyst", or "any item, level 334+". The background comes from the existing `rowTone`, so states differ in lightness as well as hue. An empty cell is a muted "—".
- **`group-priority/GroupPriority.tsx`** (server). The same season states as `DungeonPriority`. Each dungeon shows its rank, name and score, then one line per member: avatar, name, and the credited items as Wowhead links, with tier and "Any" credits as text and the weight in a `title`. Dungeons nobody needs anything from collapse into one muted line, "Nothing anyone needs from: …". The section names members using the Overall fallback and members left out of the ranking.
- **`group-vault/GroupVault.tsx`** (server). Per member: the name, then the vault choices tagged BiS or Not BiS as `VaultSection` does, or "No SimC paste yet."
- **`remember-group/RememberGroup.tsx`** (client), from decision 2.
- **`main-nav/MainNav.tsx`** (client). The header nav gains a "Group" link to `/group`. `usePathname` sets `aria-current="page"` and the active style on the current link.

**Moved because two components now use them:**

- `use-character-search.ts` moves from `add-character-bar/` to `components/hooks/`.
- `SearchResults.tsx` moves from `add-character-bar/` to its own `search-results/` directory.
- The season status messages in `DungeonPriority` (loading, failed, stale, approximate) move to a helper in `components/shared/`, so both priority sections say the same words.

`StaleSync` and `SeasonSync` mount as on the character page. `SeasonSync` gets the group's region.

## Testing

Tests come first, with the existing setup: in-memory SQLite through `openTestDb()`, a fake `fetch`, and made-up fixture names such as Birkibjörn and Hrafnhildur.

- **Member keys:** parsing junk, duplicates, more than five, mixed case and `ö`; adding a duplicate; the cap; removing; serializing.
- **Page parameters:** no parameter with a cookie redirects, no parameter without a cookie renders empty, an empty parameter never redirects.
- **`ensureBisLists` backoff:** a failure, then a call within the hour makes no request and returns the cached list with its error; after the hour it fetches again.
- **Identity lookup:** finds a tracked character by region, realm slug and folded name.
- **`getGroupPage`:** rows aligned with two rings, two trinkets and a missing Off Hand; credits grouped per member; the Overall fallback flagged per member; an untracked key; a `notFound` member and a member without gear left out of the ranking and named; the region rule dropping a key; `available` excluding members and other regions; one Method request for two members of the same spec.
- **`member.ts` extraction:** the existing character page view tests pass unchanged.
- **Components:** HTML render tests, like `DungeonPriority.test.ts`, for the cell states, the member states and the priority lines.

**Not covered automatically** (no browser tests yet, #35), so checked by hand and listed in the pull request: removing a chip, adding from the dropdown, adding by search, the Track button, the cookie write and the nav redirect, the locked region select, the sticky slot column and sideways scroll, and the five-member cap.

## Follow-ups to file

- Move the Method and Raidbots refreshes off the render path, before hosting (#8).
- Saved, named groups per user, with login (#50).
