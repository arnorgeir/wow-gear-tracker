# Group dungeon priority: readable dungeon and item cards

Status: approved
Date: 2026-10-03
Issue: #67 — Rework the group dungeon priority list
Parent specs: `docs/superpowers/specs/2026-10-03-plan-3b-group-page-design.md`, `docs/superpowers/specs/2026-09-30-plan-3a-dungeon-priority-design.md`

## Goal

Make the group dungeon priority list easy to scan when deciding which dungeon to run together. A reader should immediately distinguish dungeons, identify who benefits, and see each member's needed items and slots without hovering or clicking to reveal them.

The existing ranking is trusted for this change. This spec changes its presentation and supplies dungeon artwork; it does not change which needs count or their weights. It supersedes the group priority presentation in decision 8 of the group-page spec. The earlier specs remain authoritative for scoring, eligibility, group membership and season loot matching, except for the artwork additions explicitly described here.

## What success looks like

- Every positive-score dungeon is a distinct card with a small thumbnail, prominent dungeon title, rank and score.
- Under each benefiting member's name, individual mini cards show their needs, including visible slot labels. Long names remain readable.
- All positive-score dungeons and all their member needs are visible immediately. There are no new filters, expanders or ranking controls.
- Artwork is discovered from the season response already fetched by the app. Only URLs are stored locally; no third-party image files are committed to the public repository.
- Missing or broken artwork never hides a title, delays ranking, changes a score, or turns valid loot into a failed season load.
- The section remains usable at narrow widths and with five members. Existing season, eligibility and split-dungeon warnings remain visible.

## Decisions and reasons

### 1. Improve readability without revisiting scoring

Keep `rankDungeons` and its output ordering unchanged:

- Only evaluated rows in the `missing` state contribute. Equipped BiS below Myth, upgradable BiS, and items already in bags do not become new dungeon needs.
- Existing track weights, the tier bonus, and ring/trinket handling remain unchanged.
- Sort by total score descending, then benefiting-member count descending, then dungeon name, as today.
- Preserve per-member credit order from the engine and member order from the selected group. Do not introduce a visual sort that differs from the ranking.
- Keep the existing explanation, "Score = weighted upgrades", and the existing per-credit weight in a native `title`. This issue does not add score breakdowns or new explanations.

The owner chose readability over changing ranking behavior or expanding its explanation. Mini cards make the existing evidence easier to read without implying a new scoring model.

### 2. One visibly separate card per ranked dungeon

Keep the section heading "Dungeon priority" and its existing surrounding section container. Its ordered list contains one bordered, rounded card for each dungeon with a positive score, separated by a clear vertical gap. Use a raised surface relative to the surrounding section, so card boundaries work through lightness and borders as well as color.

Each dungeon header contains:

1. Its one-based rank, in `font-mono`.
2. A small landscape thumbnail, 64 × 48 CSS pixels, with a fixed aspect ratio and `object-cover`.
3. Its full name as an `h3`, using `font-display`, at least 18 px and bold. The name wraps rather than truncates.
4. Its existing numeric score, in `font-mono text-gold`, with an accessible label such as "Score 8". A small visible "Score" label is allowed; the value and explanation do not change.

Use at least 16 px between dungeon cards and 12 px internal padding. Text never overlays the image. The header may wrap the score onto a second line when its available width is too small; it must not squeeze or truncate the title to keep everything on one line.

The thumbnail is decorative because the adjacent title identifies the dungeon. Use empty image alt text. The title, rank and border remain sufficient when images or color cannot be perceived.

The split-dungeon warning follows the header, above the member needs, using the existing words: "Split dungeon: loot shown for the whole instance." Artwork must not imply that the app has become precise about which half drops an item.

### 3. Mini item cards beneath each member

Within each dungeon card, show only members with credits, as today. Each member has a distinct block: the existing 24 px avatar and member name on a header line, then a wrapping collection of mini cards beneath it. Use at least 12 px between member blocks and 8 px between mini cards.

Each engine credit produces exactly one mini card. Do not deduplicate across members, combine repeated slot labels, or turn a tier/Any credit into a list of every possible dungeon drop. A credit represents a need, not a guaranteed drop.

| Credit | Mini card content | Interaction |
|---|---|---|
| Named item | 28 px item icon, full item name, visible `slotLabel` on a secondary line | Whole card is the existing Wowhead link, with `data-wowhead` using the item's ID and bonus IDs; preserve `target="_blank"` and `rel="noreferrer"` |
| Tier | "Tier via catalyst", visible `slotLabel` on a secondary line | Plain text card, no link or fabricated item icon |
| Any | "Any item, level 334+" (using the actual minimum), visible `slotLabel` on a secondary line | Plain text card, no link or fabricated item icon |

Use the current `PriorityCreditView` data. Named-item credits already contain icon URLs, quality and bonus IDs; this feature needs no additional item-detail requests. Their item level and track are unknown, so do not display guessed drop levels or track names. Keep existing quality styling for named items by reusing `item-card/quality-styles.ts`; use semantic surface and border tokens for text cards.

Keep `slotLabel` exactly as supplied by the credit, including Method's distinctions such as "Ring 1" and "Ring 2". Do not infer a different equipped slot from the label or normalize it using the group grid's evaluated-slot mapping. Slot visibility is part of this feature; it must not depend on a tooltip.

Long item names and labels wrap, including an unbroken token when necessary. Do not use the current full-size `ItemCard`'s truncation behavior. Cards use `min-width: 0`, never exceed their container, and can fill a row on narrow screens. Multiple cards can sit beside one another when space permits; they are not forced into a fixed number of columns. The visual result should resemble a smaller item card rather than inline linked text.

A named item without an icon gets a 28 px decorative placeholder and still shows its full name and slot. Keyboard focus remains clearly visible on the whole link. Non-link cards must not look like buttons or receive unnecessary tab stops.

### 4. Use Raider.IO artwork and store URLs only

The existing public [Raider.IO season endpoint](https://raider.io/api/v1/mythic-plus/static-data?expansion_id=11) was inspected on 2026-10-03. Dungeon entries include `challenge_mode_id`, `short_name`, `icon_url`, and `background_image_url`. The current parser retains the first two but discards the artwork fields.

Use `background_image_url` for the landscape thumbnail. Keep the URL supplied by the API; never construct an image path from a dungeon name, slug, map ID or challenge-mode ID. `icon_url` is not a second artwork source in this scope.

- Accept a nonempty absolute HTTPS URL on `cdn.raiderio.net`, without credentials. Missing, malformed, non-string, non-HTTPS or other-host values normalize to `null`. This normalization is a small pure parser helper under test. A future provider-host change produces the fallback until explicitly supported.
- Store the normalized URL in the local database. The browser loads the image directly from that URL, like the app's existing item imagery. Do not download, proxy or commit image binaries, scrape Wowhead, or add a maintained dungeon-to-image manifest.
- Preserve the source URL and this provenance in the spec. Using a provider URL does not turn its artwork into a repository-owned asset or establish permission to redistribute image files. No such files are part of this design.
- Do not make an extra server-side image request to validate availability. A broken remote image is handled in the thumbnail component.
- Use native lazy loading, asynchronous decoding, and fixed image dimensions to avoid unnecessary image work and layout jumps.

**Fallback:** render a `bg-surface-2` tile with a `border-line-strong` border and the dungeon's short name in `font-mono text-muted`. If the short name is blank, use "M+". The fallback is decorative and hidden from assistive technology; the adjacent dungeon title remains the accessible identity. A missing URL uses it immediately; an image error replaces the image with the same-sized tile. No broken-image glyph or repeated retry loop should remain. If a later refresh supplies a different URL, try that new URL normally.

A neutral fallback is sufficient because cards already differ through their full names, spacing and borders. Do not introduce a hand-maintained color per dungeon or imply ranking strength through thumbnail color.

### 5. Keep the existing page layout and controls

The full-width gear grid stays above the priority and Great Vault sections. Those two sections remain side by side from the existing `lg` breakpoint and stacked below it. Do not widen priority at the expense of the vault or move either section.

All ranked dungeon cards and all member needs remain open. Existing membership controls and each character's priority-list setting continue to determine the ranking. There is no new state to save in the URL, cookies, local storage or database beyond artwork metadata.

At viewport widths of 320, 375, 768, 1024 and 1440 px, the priority section must fit its available column without adding page-level horizontal scrolling. At 1024 px, check the actual half-width section, not a standalone full-width card. The existing gear grid's internal sideways scroll is unchanged. Member names, dungeon titles, and item cards wrap independently.

## Data and view shape

### Season parser and storage

These are requirements for later implementation; this spec-writing change does not modify the schema or source code.

| Layer | Required change |
|---|---|
| `RawSeason.dungeons` in `src/core/raiderio/season.ts` | Accept optional `background_image_url`, with runtime normalization as above |
| `MainSeason.dungeons` | Add required `imageUrl: string \| null` |
| `season_dungeons` | Add nullable text column `image_url`; keep existing `short_name` |
| `SeasonDungeonRow` | Add required `imageUrl: string \| null` |
| `SeasonLoot` returned by the season query | Include required `shortName: string` and `imageUrl: string \| null` alongside current fields |
| `GroupDungeonView` | Add required `shortName: string` and `imageUrl: string \| null` |

Generate a new migration after changing `src/core/db/schema.ts`; never edit a committed migration. Bump `SEASON_META_KEY` from `season.v1` to `season.v2`. Leave `TRACKS_META_KEY` unchanged.

On the first due sync after migration, absence of the v2 marker causes the existing full season load even when the season slug has not changed. Existing loot remains readable with null artwork until a successful replacement. Failure preserves the old rows and uses the existing stale-data and retry behavior.

On a full season load, copy each dungeon's normalized URL onto its own season row during the existing transactional replacement. A null URL does not reject that dungeon or the season.

On the daily check when the loaded season slug is unchanged, refresh stored artwork URLs from the returned dungeon metadata, matching by challenge-mode ID and season slug. Update only matching stored rows; do not add/remove dungeons, rename them, or rebuild their loot in this path. A missing/invalid artwork field on a matching entry clears its cached URL to null; a stored dungeon absent from that response retains its existing URL. This lets provider URL corrections reach existing installs without a loot rebuild. The return status remains `current`. Keep the existing daily timing and hourly failure backoff.

The artwork updates use a focused database query helper and `withWriteLock`; batch them transactionally and mark the daily check successful only after the updates succeed. Do not nest write locks. Network failure leaves previously stored artwork intact, just as it leaves loot intact. Browser image errors never write to the database or trigger season sync.

### Identity and ranking boundary

Artwork belongs to the Raider.IO dungeon identified by `challengeModeId`. This is separate from the existing loot join:

`challenge mode → Blizzard keystone dungeon → map ID → journal instance → loot`.

Do not replace or weaken that map-ID verification. Split halves still share their journal instance's full loot and retain `split: true`; their artwork URLs remain independently associated with their challenge-mode IDs. They may be equal, different or null without changing scoring.

`rankDungeons` ignores the new presentation metadata. Do not add artwork to `DungeonRank` or `Credit`, and do not import UI or framework code into `src/core`. `getGroupPage` looks up season presentation metadata by challenge-mode ID while mapping ranks to `GroupDungeonView`. An unmatched rank defensively receives `imageUrl: null` and `shortName: ''` rather than disappearing. The page receives only the view shape and remains thin.

`GroupMemberCreditsView`, `PriorityCreditView`, ranking availability, and zero-score dungeon handling keep their existing shapes. No new score or count fields are needed. Character-page priority continues to render its existing view without artwork; incidental fixture updates for the extended season type are allowed, but its output and behavior stay unchanged.

## Component boundaries and UI behavior

- `group-priority/GroupPriority.tsx` remains a server component responsible for section messages and ranking composition.
- Put dungeon-card, member-needs and mini-credit markup in focused child component files inside `group-priority/` as needed. They are used only by this section and remain server components.
- Put the thumbnail with image-error state in `group-priority/DungeonThumbnail.tsx`, a small client child. Give it only presentation props; it performs no API mutations. Reset failed-image state when the URL changes, for example by keying its image state to the URL.
- Keep any branching display helpers in plain `.ts` files beside the component with unit tests. Do not hide score or slot logic in a hook.
- Reuse the existing avatar, quality styles and Wowhead attribute helper. Do not change the shared full-size `ItemCard` just to achieve this section's compact layout.
- Use Tailwind semantic tokens for surfaces, borders and text; add a semantic token in `globals.css` if a genuinely new visual role is necessary. Headings use `font-display`, body copy uses `font-sans`, numbers use `font-mono`.
- Keep the global Wowhead script and navigation refresh behavior. Do not load or initialize another copy per dungeon or mini card.

Keep the current season and eligibility copy and precedence. Artwork adds no warning banner:

| Situation | Result |
|---|---|
| Empty group | Existing picker and empty-group message; no priority section |
| Season loading / first load failed | Existing season message; no dungeon cards |
| No eligible member | Existing unavailable-ranking message and excluded-member reasons; never claim nothing is needed |
| Partial eligibility | Existing "Covers … Left out …" message, then eligible members' ranking |
| Overall fallback | Existing per-member fallback message |
| Tracks unavailable | Existing approximate-weights message, with the ranking |
| Older loot after failed sync | Existing stale-loot message, with cached ranking and cached artwork or placeholders |
| Eligible group, all scores zero | Existing "No season dungeon drops anything the group still needs." message |
| Some scores zero | Positive-score cards, followed by the existing "Nothing anyone needs from: …" line; no zero-score image cards |
| Split dungeon | Existing warning within that dungeon's card, above its members |
| Missing/broken dungeon artwork | Short-name tile; all title, score, warning and need content remains |
| Duplicate character display names | Preserve member keys as identity; do not merge their need blocks |

## Acceptance tests

Implementation follows the repository's test-first rules. Use made-up names such as Birkibjörn, Hrafnhildur and Sólrún, and small synthetic responses. Do not copy full provider responses or use real player characters.

### Automated

1. **Artwork parsing:** a valid provider URL survives unchanged; missing, null, non-string, empty, malformed, HTTP, credential-bearing and other-host values become null without rejecting the season. Existing main-season selection tests still pass.
2. **Storage and refresh:** in-memory SQLite round-trips image URLs and null values alongside short names. Full load stores each URL against the correct challenge-mode ID. Two split halves with the same map and journal instance can retain different URLs. The map-ID mismatch regression still rejects the wrong journal instance.
3. **Same-season refresh:** after the daily interval, a changed URL replaces the cached URL without any Blizzard loot requests. Invalid/missing artwork on a matching entry clears the URL; an absent entry leaves the stored row intact; unknown IDs do not add rows. Within the interval, no refresh occurs. Provider failure preserves old URLs and loot.
4. **Migration/cache:** an install with v1 metadata and migrated rows triggers a v2 full reload despite an unchanged slug. Until success, old loot remains readable with null artwork. A failed reload preserves rows and follows existing backoff; success records the v2 marker.
5. **Loader mapping:** `getGroupPage` associates images by challenge-mode ID even when source order differs from rank order. It preserves score, rank order, members, credits and split flags. Null artwork survives to the view. The defensive missing-metadata mapping retains the rank with the fallback fields.
6. **Ranking regression:** existing `src/core/priority/` tests stay green. Adding or changing presentation metadata cannot affect ranks or credits. Do not rewrite expected scoring to accommodate the redesign.
7. **Rendered structure:** HTML tests show an ordered list, a separate card and `h3` per positive-score dungeon, member headers followed by individual credit cards, and visible slot labels for named, tier and Any credits. Multiple members needing the same item retain separate cards. Existing credit ordering is preserved.
8. **Item links:** named cards retain Wowhead href and data attributes, including bonus IDs, and contain their icon or placeholder, full name and slot. Tier/Any cards have no item link and invent no item ID. Unknown item levels and tracks are not displayed. A long item name is not shortened in the rendered content.
9. **States and accessibility markup:** retain existing loading, failed, stale, approximate, fallback, partial/unavailable ranking, all-zero and split-warning tests. Thumbnail images have empty alt text, fixed dimensions and lazy loading; null URLs render the short-name fallback (or "M+" for a blank short name). Score has an accessible label and item links have visible-focus styling.
10. **Scope regression:** existing group editing, grid, vault and character-page tests continue to pass. No additional season or image-fetch requests occur during a page render.

Required implementation gate: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` because components change. Stop any dev server serving that folder before building, or build in an isolated worktree, following `AGENTS.md`.

### Manual acceptance and coverage gaps

The project currently has no browser-level test setup. Server-rendered HTML tests do not prove wrapping, image-error events, focus appearance or tooltip behavior. Check and record these in the implementation pull request:

- At 320, 375, 768, 1024 and 1440 px, inspect a five-member group with several needs each and long dungeon, member and item names. Cards remain distinct, text is readable, no content overlaps, and this section adds no horizontal page scrolling. Confirm the unchanged gear-grid scroll and priority/vault layout.
- Compare two dungeons at a glance: their titles stand out from member names, and every mini card clearly belongs to the member above it. All needs are visible without expansion.
- Block a thumbnail request, then try a missing URL: both give the same fixed-size fallback without a broken-image glyph. Supply a new URL on refresh and verify it can load. Slow images do not shift the surrounding content or block the ranking.
- Tab through named-item cards and verify visible focus; check their Wowhead tooltips and destinations. Tier and Any cards add no tab stops. Slot labels remain visible without hover, including on touch-sized screens.
- Verify a split warning stays attached to its dungeon, and stale/partial/approximate messages remain legible above the list.
- Check a real provider thumbnail for crop quality during implementation. The metadata probe verified URL availability, not final browser rendering or all future dungeon artwork.

## Out of scope

- Changes to scoring, weights, tier bonuses, item eligibility, tie-breaking, simulations, drop probabilities, dungeon difficulty or travel time.
- Expanded score explanations, per-member score totals, user-supplied weights or manual ranking.
- Filters, collapsed dungeons, member focus modes, saved display preferences or new group controls.
- Character-page priority redesign, gear-grid changes, Great Vault changes, member picker changes, or page layout changes.
- Determining which boss belongs to which split-dungeon half, or changing season loot's map-ID join.
- Showing actual candidate dungeon drops for tier/Any credits, or promising a particular drop level or upgrade track.
- Artwork scraping, image hosting/proxying, checked-in third-party image binaries, custom image uploads, or a manually maintained dungeon art/color catalog.
- New browser testing infrastructure, background-job architecture, login or saved groups.
- An implementation plan or implementation in this spec-writing task. The owner reviews this spec before it is committed; later workflow steps review it and prepare the plan.
