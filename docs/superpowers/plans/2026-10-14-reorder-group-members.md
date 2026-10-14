# Reorder group members: plan

Spec: `docs/superpowers/specs/2026-10-14-reorder-group-members-design.md` (the authority).
Issue: #64. Branch: `feat/reorder-group-members`.

Each task: failing test first, watch it fail, implement, run the file's tests. One commit per task, `feat:` subject unless noted.

## Task 1: `moveMember` and `edits.move`

- `src/core/characters/member-key.ts`: `moveMember(keys, key, toIndex)` beside `removeMember`. Unknown key: `[...keys]`. Else remove, clamp `toIndex` to `0 … keys.length - 1`, splice in.
- `src/components/group-edits/group-edits.ts`: `move(key, name, toIndex)`. When `apply` changes the keys, record `moved = { name, position: index + 1, count, keys: next }`; `add` and `remove` set `moved = null`. Expose `moved()` returning the record only while `moved.keys` equals `current`. `reset` leaves `moved` alone (the match check handles staleness).
- Tests in `member-key.test.ts` and `group-edits.test.ts` per the spec.

## Task 2: provider and steady panels

- `GroupEditsProvider.tsx`: export `GroupEditsContext` (test seam: tests render a context value with `pending: true`). Context gains `move` and `moved` (the provider keeps `moved` in state, set from the same `onChange` path so a render sees it).
- `src/components/group-body/same-members.ts`: `sameMembers(a, b)`: same length and every key of `a` in `b`.
- `group-body-mode.ts`: fourth param `sameMembers`; `pending && sameMembers && hasContent` gives `'content'`. Update callers and tests.
- `GroupBody.tsx`: compute `sameMembers(keys, content.grid.members.map(m => m.key))` when content exists; `requestedKeys={pending ? keys : undefined}`.
- `GroupBody.test.ts`: pending reordered context with two members gives headers in requested order, no `animate-pulse`, real dungeon and vault text. Members need minimal `GroupMemberView` objects; copy the shape from an existing `GroupGrid.test.ts` fixture.
- `GroupGrid.tsx`: key cells, note divs and `CellSkeleton` by `members[i]!.key` (same commit, say why in the body).

## Task 3: pure helpers in `group-members/`

- `order-by-keys.ts`, `move-target.ts`, `status-text.ts`, `drop-index.ts`, each with tests per the spec.
- `drop-index.ts`: `type Rect = { left, right, top, bottom }`; `dropIndex(rects, dragged, { x, y })` counts `i !== dragged` with `r.bottom < y || (y >= r.top && y <= r.bottom && x > (r.left + r.right) / 2)`. Fixed-point test: a tiny greedy-wrap helper in the test file lays out widths in a 300 px row.
- `statusText({ picked, moved, pending })`: picked name gives the pick-up text; else `moved` gives "<name> moved to position <n> of <count>."; else pending gives `GROUP_UPDATING`; else `''`.

## Task 4: `drag-state.ts` reducer

State: `{ kind: 'idle' } | { kind: 'drag', pointerId, key, preview: string[], moved: boolean } | { kind: 'picked', key }`.

Actions and results (`reduce(state, action) => { state, commit?: { key, index } }`):

- `start { pointerId, key, order, isPrimary, button }`: only from `idle` or `picked`, only `isPrimary && button === 0`. Keeps a `picked` key in the drag so `end` can tell a tap on another handle.
- `over { pointerId, index }`: ignored for another pointer. Moves `key` in `preview` to `index`; `moved = true` once the preview changed.
- `end { pointerId, order }`: another pointer ignored. When `moved`: commit `{ key, index: preview.indexOf(key) }` if that differs from `order.indexOf(key)`, then `idle`. When not moved: treat as `tap`.
- `tap { key, order }`: from `idle`, pick `key`. From `picked` with the same key, `idle`. From `picked` with another key, commit `{ key: picked, index: order.indexOf(key) }`, `idle`.
- `cancel`: `idle`.
- `membersChanged { keys }`: a drag whose key is gone, or a picked key that's gone, goes `idle`; a drag appends new keys to `preview` and drops missing ones.

Tests per the spec. The click event after a pointer tap must not tap twice: the hook calls `tap` from `onClick` only when the click came from the keyboard (`event.detail === 0`); pointer taps come through `end`.

## Task 5: `MemberChip`, `use-member-drag`, `GroupMembers`

- `use-member-drag.ts`: `useReducer`-style state with the reducer; refs to chip elements by key; handlers `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onClick` for a handle; `useEffect` adding a capture-phase `window` `keydown` while not idle (Escape: `preventDefault`, `cancel`); `useEffect` on members keys dispatching `membersChanged`. Commits call `move(key, name, index)`. Picked state also cancels when the shared `keys` change by add or remove (the `membersChanged` effect covers it).
- `MemberChip.tsx`: today's chip markup plus the handle button when `count >= 2`: `size-11 flex items-center justify-center rounded-full text-muted hover:bg-surface-2 cursor-grab touch-none select-none [-webkit-touch-callout:none]`, `aria-pressed` while picked, label per spec, `aria-describedby="group-move-hint"`, `onKeyDown` with `moveTarget` (ignored while dragging). Lifted chip: `ring-2 ring-gold shadow-lg`, plus `cursor-grabbing` on the handle while dragging.
- `GroupMembers.tsx`: `orderByKeys(members, drag preview ?? keys)`, renders chips, one hidden hint `<span id="group-move-hint" className="sr-only">`, row `select-none` while dragging, status from `statusText`.
- `GroupMembers.test.ts`: the markup cases in the spec.

## Task 6: Playwright

- `e2e/group-reorder.spec.ts`, keys like `eu.kazzak.birkiþór,eu.kazzak.birkiörn` (untracked members render as name chips; see `api-action.spec.ts`).
- Holding the navigation: `page.route` for `/group?` requests with an `rsc` header, gated like `holdRequest`; check no `animate-pulse` in the dungeon panel, then release.
- Cases per the spec. Touch: `test.use({ hasTouch: true })` in a describe block, dispatch `pointerdown`/`pointermove`/`pointerup` with `pointerType: 'touch'` through `locator.dispatchEvent`, or CDP `Input.dispatchTouchEvent`, whichever moves the chip.
- Run `npm run test:e2e -- group-reorder`. Commit as `feat:`, since it ships with the feature.

## Gate

`npm run typecheck && npm run lint && npm test && npm run build` (components changed; build in the worktree is safe), then `npm run test:e2e`.

## Next

Draft PR, then the review-loop skill.
