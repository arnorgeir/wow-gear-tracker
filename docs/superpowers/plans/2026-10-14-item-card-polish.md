# Item Card Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Class icon badge on the character card and header (#25), Wowhead tooltip on the whole item wherever an item shows with its icon (#89), and one rarity rule for every item link (#65). The same pull request also ships #112 (character page loader) from its own plan.

**Architecture:** No schema change, no migration, no cache version bump, no new view field. Changes are component markup plus one rule swap in `src/server/views/member.ts`. Every markup change gets a `renderToStaticMarkup` test beside the component.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Vitest (`environment: 'node'`, markup tests through `renderToStaticMarkup`).

**Spec:** `docs/superpowers/specs/2026-10-14-item-card-polish-design.md`. The spec is the authority; read each issue's section before its task. #112's spec is `docs/superpowers/specs/2026-10-13-character-page-loader-design.md`.

**Branch:** `feat/item-card-polish` (exists, holds both specs and both plans). Before Task 1:

1. `git fetch origin`.
2. If PR #143 (`feat/minor-polish-batch`) has merged, `git rebase origin/main`; otherwise `git rebase origin/feat/minor-polish-batch`, and say in the pull request that it builds on #143.
3. Confirm the base: `git grep -n pickQuality -- src/core/bis/pick-quality.ts src/components/item-search/RarityBox.tsx` must print hits. If it prints nothing, stop: this plan needs #143's code.
4. `npm ci`.

## Global Constraints

- Failing test first, watch it fail, then code. One commit per task at least, through the repo's `commit` skill: `feat:` or `fix:`, lowercase imperative, terse why-body only when the subject doesn't say it. No AI attribution or mention anywhere.
- Tests sit beside the code as `*.test.ts`, rendering with `createElement` and `renderToStaticMarkup`. React 19 hoists `<link rel="preload">` for images; strip them as `CharacterAvatar.test.ts` does (`.replace(/<link[^>]*\/>/g, '')`) where an `<img>` renders.
- Fixtures use made-up names (Birkibjörn style). No real players.
- Nothing interactive goes inside an `<a>`.
- Tailwind classes are literal strings (no string-built class names), so Tailwind sees them.
- Gate before the pull request: `npm run typecheck && npm run lint && npm test`, then `npm run build` with no dev server serving this worktree.

## Review Focus

1. **Overlay toggle (Task 4).** A click on the cell of an open details card closes it and does not reopen it.
2. **No-track hint (Task 5).** The hint is visible text outside the Wowhead link, only when `trackLabel === null && tracksKnown`, and no `title` holds it.
3. **Link extent (Tasks 6, 7).** Pick and search links size to content (`w-fit` / no `grow`); blank row space opens nothing; Choose buttons line up.
4. **Quality per caller (Task 7).** Usable results show `pickQuality`, the unusable row its base quality (`?? 'COMMON'`).
5. **Shared file order.** #112 edits the `CharacterCard` name link; #25 edits the avatar. Task 1 lands #112 first so Task 3 edits on top of it.

---

### Task 1: #112 Character page loader

**Files:** as listed in `docs/superpowers/plans/2026-10-13-character-page-loader.md`.

- [ ] Execute that plan's Tasks 1 to 5 as written, on this branch. Ignore its Branch line (`feat/character-page-loader`): everything goes on `feat/item-card-polish`. Its Task 1 probe runs only in a local session with `.env` and a database; in a cloud session skip it as that plan's Clarifications say.
- [ ] Skip that plan's Task 6. Its hand checks join this plan's Task 9, and the pull request is this plan's.
- [ ] Its commits are its own; no extra commit here.

### Task 2: #65 One rarity rule for BiS targets and credits

**Files:** Modify `src/server/views/member.ts`. Test: `src/server/views/views.test.ts`.

- [ ] Tests: in the `creditView` describe, an `item` credit (`kind: 'item', slotLabel: 'Trinket', weight: 2, itemId: 242395, name: 'Astral Antenna', bonusIds: []`) gives `item.quality === 'EPIC'`. In the `rowView stat pairs` describe (or a new `bisView` describe importing `bisView`), `rowView(tierRow, ...)` gives `bis.quality === 'EPIC'`. These pass already; they pin the behavior through the swap.
- [ ] In `bisView` and `creditView`, replace `quality: 'EPIC'` with `quality: pickQuality(null)`; import `pickQuality` from `@/core/bis/pick-quality`.
- [ ] Run the tests; still green.
- [ ] Commit `chore: take bis and credit rarity from the pick rule` (body: one rule owns pick rarity across pages and editor).

### Task 3: #25 Class icon badge on the avatar

**Files:** Modify `src/components/character-avatar/CharacterAvatar.tsx`, `src/components/character-card/CharacterCard.tsx`, `src/components/character-page/CharacterHeader.tsx`. Test: `src/components/character-avatar/CharacterAvatar.test.ts`.

- [ ] Tests (add to the existing describe):
  - `classBadge: 'surface'`, both URLs, size 52: two `<img>`; the wrapper span carries `relative block shrink-0` and `width:52px;height:52px`; the badge `<img>` has `src` of the class icon, `width="21"`, and `border-surface`; the avatar `<img>` has `block`.
  - `classBadge: 'bg'`: the badge has `border-bg`. Size 76 gives `width="30"`.
  - `classBadge: 'surface'`, `avatarUrl: null`: one `<img>` (the class icon), no wrapper span.
  - No `classBadge`: markup equals today's (one `<img>`, no `relative`).
- [ ] Implement. Add `classBadge?: 'surface' | 'bg'` to `Props`. When `classBadge && avatarUrl && classIconUrl`:

  ```tsx
  const badge = Math.round(size * 0.4);
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <img src={avatarUrl} alt="" width={size} height={size}
        className="block rounded-full border-2 bg-bg object-cover" style={{ width: size, height: size, borderColor: color }} />
      <img src={classIconUrl} alt="" width={badge} height={badge}
        className={`absolute -bottom-1 -right-1 block rounded-md border-2 ${classBadge === 'surface' ? 'border-surface' : 'border-bg'}`}
        style={{ width: badge, height: badge }} />
    </span>
  );
  ```

  Otherwise keep the existing branches unchanged.
- [ ] `CharacterCard.tsx`: pass `classBadge="surface"` to its `CharacterAvatar`. `CharacterHeader.tsx`: pass `classBadge="bg"`.
- [ ] Run `CharacterAvatar.test.ts`, `CharacterCard.test.ts`, `CharacterHeader.test.ts`; fix only assertions that counted `<img>` tags on the card or header.
- [ ] Commit `feat: badge character avatar with class icon`.

### Task 4: #89 Group cell is one Wowhead overlay

**Files:** Modify `src/components/group-grid/GroupCell.tsx`. Test: create `src/components/group-grid/GroupCell.test.ts`.

- [ ] Tests (fixture: copy `CellDetails.test.ts`'s `equipped` and `tier` row; render `createElement(GroupCell, { cell, tracksKnown: true, slotLabel: 'Shoulders', memberName: 'Birkibjörn', character: null })`):
  - Equipped: one `<a` with `data-wowhead`, its class contains `absolute inset-0 z-10 rounded-lg`, and it has `tabindex="-1"` and `aria-hidden="true"`. The `<a ...>` closes empty (`></a>`), so the icon is not inside it.
  - The `<button` still has `aria-label="Birkibjörn, Shoulders: …"` (match on `aria-label="Birkibjörn, Shoulders:`) and a `title=`, using a `missing` row so `needText` gives a title.
  - `equipped: null`: no `<a`.
- [ ] Implement:
  - Add `const wasOpen = useRef(false);`.
  - Render the icon directly (`<span className="shrink-0">{icon}</span>` in both cases); delete the icon-wrapping `<a>`.
  - After the `<button>`, when `eq`:

    ```tsx
    <a href={`https://www.wowhead.com/item=${eq.itemId}`} data-wowhead={wowheadData(eq.itemId, eq.bonusIds, eq.itemLevel)}
      target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-10 rounded-lg"
      onPointerDown={() => { wasOpen.current = document.getElementById(id)?.matches(':popover-open') ?? false; }}
      onClick={(e) => { e.preventDefault(); if (!wasOpen.current) button.current?.click(); wasOpen.current = false; }} />
    ```

  - Rewrite the component comment: the cell is covered by a Wowhead link so hovering anywhere shows the tooltip; a click opens the details card (or closes an open one, since the card's light dismiss already closed it on pointerdown); the button stays the only tab stop; its `title` shows only on an empty cell, and the card holds the need, "Stats unverified" and the no-track hint.
- [ ] Commit `feat: show wowhead tooltip over the whole group cell`.

### Task 5: #89 Details card item is one link, hint as text

**Files:** Modify `src/components/cell-details/CellDetails.tsx`. Test: `src/components/cell-details/CellDetails.test.ts`.

- [ ] Tests:
  - With `iconUrl: 'https://i/1.jpg'`: the `<img src="https://i/1.jpg"` appears after `data-wowhead=` and before the next `</a>`.
  - `trackLabel: null`, `tracksKnown: true`: the markup contains `NO_TRACK_HINT` (import from `@/components/shared/track-label`) after the link's `</a>`, and no `title="Not on a current season`.
  - `trackLabel: null`, `tracksKnown: false`: no `NO_TRACK_HINT`. `trackLabel: 'Myth 6/6'`, `tracksKnown: true`: no `NO_TRACK_HINT`.
  The test's `render` helper takes `tracksKnown` as a second argument (default `true`).
- [ ] Implement: when `eq`, replace the `div.mt-2.flex.items-start.gap-2.5` with an `<a>` carrying the current name link's `href`, `data-wowhead`, `target`, `rel`, plus `className="mt-2 flex items-start gap-2.5 no-underline"`. Inside: the icon, then the column with the name as `<span className="font-semibold wrap-anywhere" style={{ color: q!.text }}>` and the detail span without its `title`. When `!eq`, keep a `div` with the dashed box and "Nothing equipped". After it, `{eq && track.hint && <p className="mt-1 text-[13px] text-muted">{track.hint}</p>}`.
- [ ] Commit `feat: link the whole equipped item in cell details`.

### Task 6: #89 #65 Pick line is one content-sized link

**Files:** Modify `src/components/bis-editor/PickLine.tsx`. Test: create `src/components/bis-editor/PickLine.test.ts`.

- [ ] Tests:
  - `itemId: 249337, quality: 'EPIC', iconUrl: 'https://i/2.jpg'`: markup starts with `<a`, the `<a` class contains `group inline-flex w-fit max-w-full`, the `<img` sits inside it, and the name span has `group-hover:underline`.
  - `itemId: null` ("Any" pick): no `<a`.
  - `replaced: true`: contains `opacity-80` and `line-through`, not `opacity-60`.
- [ ] Implement: build the inner content (icon, then the name/detail column) once. When `itemId !== null`, wrap it in `<a href=… data-wowhead={wowheadData(itemId, [], null)} target="_blank" rel="noreferrer" className={`group inline-flex w-fit max-w-full min-w-0 items-center gap-3 no-underline ${replaced ? 'opacity-80' : ''}`}>`; else in the existing `div` with `opacity-80` for `replaced`. The name becomes a `<span className={`truncate text-[15px] font-semibold group-hover:underline ${replaced ? 'line-through' : ''}`} style={{ color: q?.text }}>`.
- [ ] Commit `feat: link the whole pick line and keep replaced picks readable` (body: opacity-60 dropped Epic to 3.3:1; 80 clears 4.5:1).

### Task 7: #89 #65 ItemLink for search results

**Files:** Create `src/components/item-search/ItemLink.tsx`, `ItemLink.test.ts`. Modify `RarityBox.tsx`, `RarityBox.test.ts`, `ItemSearch.tsx`.

- [ ] `RarityBox.test.ts`: change it to pass `quality` directly: `render({ quality: 'EPIC', iconUrl })` gives `border-color:#a335ee`; `render({ quality: 'RARE', iconUrl: null })` gives `border-color:#0070dd`.
- [ ] `ItemLink.test.ts`: `ItemLink({ item: { itemId: 9, name: 'Ironvein Girdle', iconUrl: null, … }, quality: 'RARE', children: 'Leather · Waist' })` renders one `<a` with `data-wowhead="item=9"` and class `inline-flex max-w-full`, the ring `border-color:#0070dd`, the name colored `#5eaaff`, and the children text inside the link. With `quality: 'EPIC'` the name is `#c58cf5`. (This is the unusable row's case: base Rare shows Rare, not Epic.)
- [ ] Implement `RarityBox({ quality, iconUrl }: { quality: Quality; iconUrl: string | null })`, ring from `QUALITY_STYLES[quality]`, no `pickQuality` inside.
- [ ] Implement `ItemLink({ item, quality, children }: { item: Pick<ItemChoice, 'itemId' | 'name' | 'iconUrl'>; quality: Quality; children?: React.ReactNode })`: `<a href=… data-wowhead={wowheadData(item.itemId, [], null)} target="_blank" rel="noreferrer" className="group inline-flex min-w-0 max-w-full items-center gap-3 no-underline">`, then `<RarityBox quality={quality} iconUrl={item.iconUrl} />`, then `<span className="flex min-w-0 flex-col gap-px">` with the name `<span className="text-[15px] font-semibold group-hover:underline" style={{ color: QUALITY_STYLES[quality].text }}>` and `children`.
- [ ] `ItemSearch.tsx`: delete `ItemName`. Chosen card: `<ItemLink item={chosen} quality={pickQuality(chosen.quality)} />`. Result row: `<ItemLink item={item} quality={pickQuality(item.quality)}><span className="text-[13px] text-muted">{resultDetail(item)}</span></ItemLink>` then the Choose button with `ml-auto` added to its class. Unusable row: `<ItemLink item={unusable} quality={unusable.quality ?? 'COMMON'}><span className="text-[13px] text-legacy">{reason}</span></ItemLink>` (reason as today), then `<span className="ml-auto text-[13px] text-dim">Can&apos;t choose</span>`; drop the empty box span and the `text-dim` name.
- [ ] Commit `feat: link whole search results with their own rarity`.

### Task 8: Gate

- [ ] `npm run typecheck && npm run lint && npm test`. All clean.
- [ ] Stop any dev server serving this worktree. `npm run build`. Clean.
- [ ] Fix anything red in its own `fix:` commit.

### Task 9: Hand checks and pull request

- [ ] Run the hand checks in both specs' Testing sections (this spec's per issue, and #112's probe cases), locally, or list them as owner checks in a cloud session. Include: the 1440 px group cell hover, open, second-click-closes; blank editor and search row space opens nothing; Choose buttons aligned with short and long names; the badge on card and header at 375 and 1440 px.
- [ ] Open the pull request per `AGENTS.md`: `Closes #25, closes #65, closes #89, closes #112.`, `## What changes` with one bullet per issue, `## Testing` with the test count, gate results, hand checks done and those left to the owner, and gaps (no browser tests: hover, popover toggle and alignment checked by hand). Close with both spec paths. If #143 hadn't merged, say the branch builds on it.
- [ ] Move #25, #65, #89, #112 to In review and continue with the `review-loop` skill.
