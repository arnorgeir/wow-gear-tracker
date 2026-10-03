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
- **Parsing** lives in a plain module and is unit tested. Keys that don't parse are dropped, and duplicates are dropped. Name matching is case-insensitive through `nameKeyOf`, so `Birkibjörn` and `birkibjörn` are the same member. The five-member cap applies after the region rule (decision 3), so keys from another region never take a valid member's place.
- **One builder for keys:** `memberKeyOf({ region, realmSlug, name })` in the same module is the only place a key is made. Realm slugs always come from a stored character row, which got its slug from Blizzard's profile. A key is never built from a realm display name or a Raider.IO slug.

### 2. Remembering the last group

- **A `group` cookie** holds the same comma-separated key list as the URL.
- **A client component**, `remember-group/RememberGroup.tsx`, writes it with `document.cookie` (`path=/`, a one-year `max-age`, `SameSite=Lax`) whenever the rendered member list changes. This covers membership edits and opening a link. The value is `encodeURIComponent` of the comma-joined keys, so `ö` survives.
- **Reading** uses the async `cookies()` from `next/headers`. The value goes through `decodeURIComponent`; a value that fails to decode counts as no cookie. Keys never contain `%`, so a value Next already decoded comes through a second decode unchanged. The decoded string then goes through the same key parser as the URL, so a tampered cookie can only yield valid keys or none.
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
  - A search result holds a Blizzard realm ID and a realm display name, but no slug, so the client can't build the key itself. **The route's response gains `key`**, built with `memberKeyOf` from the stored character row, for a new character and an already tracked one alike: `{ id, created, key }`. `addCharacter` returns the stored row's region, realm slug and name for this.
  - The Characters page keeps using `id` and its behavior doesn't change.
  - Adding a key the group already has changes nothing.
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

Dimming always comes with words beside it, never opacity alone.

`StaleSync` gets only members with status `ok`, as on the Characters page, so a `notFound` member isn't retried on every load. Its Refresh and Remove buttons are the way forward.

### 5a. Who the ranking covers

A member is **eligible** for the ranking when it is tracked, has gear, and has a BiS list to evaluate. Others are **excluded**, each with its reason: not tracked, no gear yet, or no BiS list. The season's status (loading, failed, stale, ready) is separate from eligibility, and the section shows both.

| Situation | Priority section shows |
|---|---|
| Season loading or failed | The season message, as on the character page. No ranking |
| Season ready, no eligible member | "Dungeon priority needs at least one member with gear and a BiS list." and each excluded member with its reason. `rankDungeons` isn't called, and nothing claims the group needs nothing |
| Some members eligible, some excluded | The ranking, under "Covers Birkibjörn and Hrafnhildur. Left out: Sólrún (no gear yet)." |
| All eligible, a dungeon scores | The ranking |
| Eligible members, every dungeon scores zero | "No season dungeon drops anything the group still needs." |

### 6. A failure backoff for `ensureBisLists`

Every page refreshes Method's BiS lists during the render when they are a day old. Unlike `ensureTracks`, `ensureBisLists` has no backoff: while Method is down, every page load waits for the request to fail, up to ten seconds. A group page with five specs makes this worse.

- **On failure** it records `bis.<spec slug>.failed` in `meta`, with the error message as the value and the time as `updatedAt`. For one hour it skips refetching that spec and returns what a failed fetch returns now: the cached list and its fetch time when there is a cache, and `lists: null` when there isn't, with the stored message in both cases. A cold-cache 404 therefore keeps saying "Method has no gearing page for …" during the hour, not a generic message.
- **After the hour** it fetches again. Success replaces the list and the failure entry stops mattering, because a fresh cache is checked first.
- This matches `ensureTracks`, which also retries at most hourly.
- **Cold cache cost** stays: the first load of the day may wait a second or two for Method. That is acceptable for a local app. The full move off the render path gets its own issue, to be done before hosting (#8).

### 7. The loader

`src/server/views/group-page.ts` exports `getGroupPage(services, keys): GroupPageView`. The page passes it the parsed keys and renders the result.

1. `ensureTracks` once, and `listCharacters` once for both the members and the dropdown.
2. Apply the region rule, then the five-member cap. Resolve each key to a tracked character, or mark it untracked.
3. For each tracked member, in sequence for database work: load gear, ensure BiS lists (fetches deduped by spec slug, as `getCharacterCards` does), choose the priority list with the Overall fallback, and evaluate the rows. Each member uses its own priority list setting, as on the character page.
4. `readSeason`, then, when at least one member is eligible (decision 5a), `rankDungeons` over the eligible members.
5. `ensureItemIcons` once, for every item ID across the members, their BiS rows, vault choices and credits.
6. Align the grid by **evaluated slot**: one grid row per `SlotType`, in `SLOT_TYPES` order, keyed by each `GearRow.slot`. Method's labels are not keys, because specs name the same slot differently (`Weapon`, `Main Hand`, `Main-Hand`; `Gloves`, `Hands`), and the first Ring row can evaluate to `FINGER_2` when `evaluateGear` assigns exact matches first. Each grid row's label comes from one fixed map: Head, Neck, Shoulders, Cloak, Chest, Wrist, Gloves, Belt, Legs, Boots, Ring 1, Ring 2, Trinket 1, Trinket 2, Main Hand, Off Hand. A cell holds that member's equipped item and BiS target for that slot together. A member with no row for a slot, such as an Off Hand under a two-hander, gets an empty cell, and no other row moves. A slot that no member has a row for is left out.

**`GroupPageView`** carries:

- `region`, or null for an empty group.
- `members`: each member's key, state from decision 5, summary when tracked, crests, the list used and whether it fell back, and the BiS error.
- `grid`: rows of `{ slotLabel, cells }`, where a cell is a `GearRowView` or null.
- `priority`: the season status, the approximate flag, the eligible members, the excluded members with their reasons, ranked dungeons, and the dungeons nobody needs anything from. Each ranked dungeon carries `challengeModeId`, name, score, the `split` flag from `rankDungeons`, and credits grouped per member (avatar, name, credits). `ranking` is null when no member is eligible, so the view can't confuse "unavailable" with "nothing needed".
- `vault`: per member, the paste time (null without a paste) and the vault choices with their BiS flag. This keeps `VaultSection`'s three states apart: no paste, a paste with no choices, and a paste with choices.
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
- **`group-priority/GroupPriority.tsx`** (server). The season states as `DungeonPriority` shows them, and the eligibility states from decision 5a. Each dungeon shows its rank, name and score, then one line per member: avatar, name, and the credited items as Wowhead links, with tier and "Any" credits as text and the weight in a `title`. A split dungeon shows "Split dungeon: loot shown for the whole instance." beside its credits, as `DungeonPriority` does, because a credited item may drop in the other half. Dungeons nobody needs anything from collapse into one muted line, "Nothing anyone needs from: …". The section names members using the Overall fallback.
- **`group-vault/GroupVault.tsx`** (server). Per member: the name, then one of three states, as `VaultSection` has them: "No SimC paste yet.", "No item choices in the vault in the last paste.", or the choices tagged BiS or Not BiS. With a paste, the age shows beside the name ("from SimC pasted 3 days ago"), so old choices read as old.
- **`remember-group/RememberGroup.tsx`** (client), from decision 2.
- **`main-nav/MainNav.tsx`** (client). The header nav gains a "Group" link to `/group`. `usePathname` sets `aria-current="page"` and the active style on the current link.

**Moved because two components now use them:**

- `use-character-search.ts` moves from `add-character-bar/` to `components/hooks/`.
- `SearchResults.tsx` moves from `add-character-bar/` to its own `search-results/` directory.
- The season status messages in `DungeonPriority` (loading, failed, stale, approximate) move to a helper in `components/shared/`, so both priority sections say the same words.

`StaleSync` mounts as on the Characters page, with stale `ok` members only. `SeasonSync` mounts only when the group has a region, and gets that region; an empty group has none, and loads no season.

## Testing

Tests come first, with the existing setup: in-memory SQLite through `openTestDb()`, a fake `fetch`, and made-up fixture names such as Birkibjörn and Hrafnhildur.

- **Member keys:** parsing junk, duplicates, mixed case and `ö`; `memberKeyOf`; adding a duplicate; the cap; removing; serializing. The region rule before the cap: one EU key, four US keys, then four EU keys keeps five EU members.
- **Page parameters and cookie:** no parameter with a cookie redirects, no parameter without a cookie renders empty, an empty parameter never redirects. A full round trip: keys with `ö` encoded as the client writes them, decoded and redirected to the same keys. A malformed value counts as no cookie.
- **`ensureBisLists` backoff:** a failure with a cache, then a call within the hour makes no request and returns the cached list with the stored error. A cold-cache 404, then a call within the hour returns no list and keeps the "no gearing page" message. After the hour it fetches again, and a success returns the new list with no error.
- **Identity lookup:** finds a tracked character by region, realm slug and folded name.
- **Add route:** `POST /api/characters` returns a `key` for a new character and for one already tracked. Cover a multi-word realm (`argent-dawn` with display name "Argent Dawn") and a mixed-case accented name; the key resolves back to the same character through the identity lookup.
- **`getGroupPage`:**
  - Alignment: `Weapon` and `Main Hand` lists land in one Main Hand row, and `Gloves` and `Hands` in one Gloves row. A first-listed BiS ring matched in `FINGER_2` lands in Ring 2 with its equipped item, and the same for trinkets. A two-hander's missing Off Hand is an empty cell with every other row in place.
  - Ranking: credits grouped per member; the Overall fallback flagged per member; both halves of a split dungeon keep `split`; scores match `rankDungeons` for the same members.
  - Eligibility: all members excluded gives no ranking and names each reason; a partly eligible group names who is covered and who is left out; an eligible group needing nothing gives an empty ranking, not a null one.
  - Members: an untracked key; a `notFound` member; `staleIds` without the `notFound` member; the region rule dropping a key; `available` excluding members and other regions; one Method request for two members of the same spec.
  - Vault: no paste, a paste without choices, and a paste with choices stay distinct.
- **`member.ts` extraction:** the existing character page view tests pass unchanged.
- **Components:** HTML render tests, like `DungeonPriority.test.ts`, for the cell states, the member states, the eligibility messages, the split warning (shown for a split dungeon and not for an ordinary one), and the three vault states.

**Not covered automatically** (no browser tests yet, #35), so checked by hand and listed in the pull request: removing a chip, adding from the dropdown, adding by search, the Track button, the cookie write and the nav redirect, the locked region select, the sticky slot column and sideways scroll, and the five-member cap.

## Follow-ups to file

- Move the Method and Raidbots refreshes off the render path, before hosting (#8).
- Saved, named groups per user, with login (#50).
