# Reorder group members

Status: unattended spec. The owner chose drag and drop over move buttons on 2026-10-14; the rest follows the loop's defaults and is reviewed with the code in the pull request. Spec review round 1 (Opus reviewer; Codex hit its usage limit) folded in: S1.1 a tap on a handle picks the member up and a tap on another handle drops it there, so reordering needs no drag (WCAG 2.5.7) and works with screen readers that keep the arrow keys; S1.2 `GroupBody` passes `requestedKeys` whenever an edit is pending; S1.3 the move announcement lives in the shared edits, so any other edit clears it; S1.4 the drag preview is a key order and cancels when the dragged member leaves; S1.5 one pointer per drag, and keys other than Escape are ignored during a pointer drag; S1.6 Escape is a window listener during a drag; S1.7 drag rules are a pure reducer with tests; S1.8 Playwright tests ship with the change; S1.9 `dropIndex` wording and extra cases; S1.10 focus wording; S1.11 grid cells keyed by member; S1.12 handle size and touch styles; S1.13 `move-target.ts`.
Date: 2026-10-14
Issues: #64

## Goal

Let the user change the order of members on the group page. The order is the order of keys in `?chars=` and in the `group` cookie (#44), and the grid's columns and the member chips follow it. Today the only way to change it is to remove members and add them back.

## Scope

In scope: dragging a member chip to a new place in the chip row, a tap and a keyboard way to do the same, touch support, and keeping the page steady while a reorder loads.

Out of scope:

- Dragging grid columns. The chip row is the one place that edits membership (`GroupEditsProvider`), and the grid already follows its order.
- A drag library. The interaction is a handful of pointer handlers; a dependency would need the owner's sign-off and buys nothing here.
- Server, schema or cookie changes. `getGroupPage` already keeps the URL's order (`selectGroup` filters, it never sorts), and `RememberGroup` writes whatever keys rendered.

## Interaction

**A grip handle on each chip.** When the group has two or more members, each chip in `GroupMembers` starts with a grip button (six dots, `aria-hidden` svg), before the avatar. It is `size-11` (44 px), matching the remove button, with `cursor-grab`, `touch-none`, `select-none` and `[-webkit-touch-callout:none]`, so a long press on iOS shows no callout. The handle is the drag source, the tap target and the keyboard control; the chip's name, avatar and remove button keep their own behavior, and a stray press on the chip never starts a drag. With one member the handle doesn't render. Five chips with handles wrap onto more rows at 375 px, as chips already do.

**Pointer events, not HTML5 drag events.** HTML5 `draggable` fires no drag events for touch on Android Chrome, and on iOS it needs a long press with a system drag image we can't style. Pointer events handle mouse, pen and touch in one path:

- `pointerdown` on a handle starts a drag only when `isPrimary && button === 0` and no drag is active. It calls `setPointerCapture`, stores the `pointerId` and copies the current display order of keys into a local preview. Events from any other pointer are ignored.
- `pointermove` from that pointer measures each chip's `getBoundingClientRect()` in preview order and asks `dropIndex` (below) where the pointer is. When the answer differs from the dragged key's place in the preview, the preview moves it there, so chips slide aside live as the pointer passes them.
- `pointerup` from that pointer ends the drag. When the dragged key's index in the preview differs from its index in the shared order, it calls `move(key, index)` on the shared membership, which navigates as add and remove do. When the pointer never moved the chip, the release counts as a tap (below).
- `pointercancel` and Escape drop the preview and change nothing. Escape is a `keydown` listener on `window` in the capture phase, added when a drag starts and removed when it ends, because Safari and Firefox on macOS don't focus a button on click. During a pointer drag, arrow keys, Home and End do nothing.
- When the dragged member leaves the rendered members (a removal finishing mid-drag), the drag cancels. This is checked against `members`, never through `lostpointercapture`, which a detached node never delivers to React. A member that arrives mid-drag joins the end of the preview.
- While a drag is active the chip row is `select-none`, so a drag doesn't select text.

**Tap to move.** A tap on a handle (a click, or a press and release that moved nothing) picks that member up:

- The handle gets `aria-pressed="true"` and the lifted style.
- The other handles' labels become "Move <picked name> to position <n>", where n is that handle's position. Activating one commits `move(pickedKey, n - 1)` and drops the member.
- Activating the picked handle again, or Escape, puts it down with no change. Any other edit (an add or remove) also puts it down.
- The status region says "<name> picked up. Choose where to move it, or press Escape."

This is the single-pointer alternative to dragging, and the path for screen readers: NVDA and JAWS keep the arrow keys in browse mode, and VoiceOver on iOS and TalkBack have none, but all of them can activate a button.

**What the lifted chip looks like.** While dragged or picked up, it lifts: a `ring-2 ring-gold` outline, `shadow-lg`, and `cursor-grabbing` during a drag. Outline and shadow change as well as color, and `aria-pressed` and the status say it in words.

**Keyboard.** The handle is a `<button>` with `aria-label="Move <name>, position <n> of <count>"` (or the drop label while another member is picked up), and `aria-describedby` pointing at one hidden hint: "Drag, or press to pick up. Arrow keys, Home and End also move it." On a focused handle with nothing picked up:

- ArrowLeft and ArrowUp move the member one place earlier, ArrowRight and ArrowDown one place later.
- Home moves it first, End last.
- A move at the edge does nothing.

Each key press commits at once through `move`. React keeps the keyed element and refocuses it after the commit, so focus ends on the moved member's handle and repeated presses keep moving it, though blur and focus events fire on each move. The handle carries no blur or focus logic; an e2e test guards the focus.

**Status text.** The existing `role="status"` region in `GroupMembers` shows, in order of priority: the pick-up text while a member is picked up; "<name> moved to position <n> of <count>." after a move while the group updates; `GROUP_UPDATING` for any other pending edit; nothing otherwise. The move text belongs to the shared edits: `move` records it with the keys it produced, add and remove clear it, and it shows only while the asked-for keys still match. A pure `statusText(...)` makes the choice.

## Data flow

- **`moveMember(keys, key, toIndex)`** in `src/core/characters/member-key.ts`, beside `addMember` and `removeMember`. It returns a new array with `key` at `toIndex`, clamped to `0 … keys.length - 1`. An unknown key returns a copy unchanged.
- **`createGroupEdits`** gains `move: (key, toIndex) => apply(moveMember(current, key, toIndex))`. It composes against the asked-for membership like add and remove, so a move made while an add is loading keeps the added member. `apply` already skips a no-op.
- **`GroupEditsProvider`** exposes `move`, and `moved: { name, position, count } | null`, the last move while its keys are still the ones asked for. `move` takes the member's name for the announcement.
- **Chip order.** `GroupMembers` draws its rendered `members` as `orderByKeys(members, order)` (`group-members/order-by-keys.ts`): members in `order`'s order, then any not in `order` (a removal still loading) in their rendered order. `order` is the drag preview during a drag and the shared `keys` otherwise, so the row shows the new order the moment a drag, tap or key press commits.

## Keeping the page steady while a reorder loads

Today any pending edit skeletons the dungeon and vault panels, which is right for add and remove: both depend on every member. A reorder changes no member, so those panels stay.

- `sameMembers(requested, rendered)` in `group-body/same-members.ts` is true when both hold the same keys as a set.
- `groupBodyMode` gains that as a fourth input. With `pending && sameMembers && hasContent`, the mode is `'content'`.
- `GroupBody` passes `requestedKeys={pending ? keys : undefined}` to `GroupGrid`, so the grid draws real columns in the requested order through `gridColumns` in every pending case, content or skeleton.

The panels show the old order until the server answers, which only changes the vault's list order.

**Grid cells keyed by member.** `GroupGrid` keys each cell, note `div` and `CellSkeleton` by `members[i].key`, not by index, so after a reorder an open `CellDetails` popover stays with its member.

## Files

- `src/core/characters/member-key.ts`: `moveMember`, with tests.
- `src/components/group-edits/group-edits.ts` and `GroupEditsProvider.tsx`: `move` and `moved`.
- `src/components/group-body/`: `same-members.ts`, `group-body-mode.ts`, `GroupBody.tsx`.
- `src/components/group-grid/GroupGrid.tsx`: cell keys.
- `src/components/group-members/`:
  - `GroupMembers.tsx` renders `MemberChip`s in display order and the status region.
  - `MemberChip.tsx`: one chip, with the handle when a reorder is possible.
  - `drag-state.ts`: a pure reducer, `start`, `over`, `end`, `cancel`, `membersChanged`, `tap`. It holds the drag (pointer id, key, preview) or the picked member, and `end` and `tap` return the move to commit, if any.
  - `drop-index.ts`: `dropIndex(rects, dragged, point)`.
  - `order-by-keys.ts`: `orderByKeys`.
  - `move-target.ts`: `moveTarget(key, index, count)`, mapping a key press to a target index or `null`.
  - `status-text.ts`: `statusText(...)`.
  - `use-member-drag.ts`: wires pointer and window listeners, measures rects and feeds the reducer. It holds no rules.
- `e2e/group-reorder.spec.ts`.

## `dropIndex`

`dropIndex(rects, dragged, point)` takes the chips' rects in display order, the dragged chip's index and the pointer, and returns the index the dragged chip should take. Chips wrap (`flex-wrap`), so it reads in reading order. Among the other chips, it counts those the pointer is past: a chip is passed when its bottom is above the pointer, or when the pointer is within its row (`top ≤ y ≤ bottom`) and right of its horizontal center. The count is the target index. Above the first row, or left of the first chip within the first row, gives 0; past the last chip gives the last index.

ponytail: comparing to centers on a greedy-wrapped row isn't proven stable when a move shifts line breaks. A fixed-point test covers made-up widths; add hysteresis if it flickers by hand.

## Testing

Unit tests, written first:

- `moveMember`: earlier, later, to the same place, clamped below 0 and past the end, unknown key.
- `group-edits`: `move` calls `onChange` with the new order, a no-op move doesn't, a move after an add keeps the added key, and an add or remove after a move clears `moved`.
- `sameMembers` and `groupBodyMode`: pending with the same members and content gives `'content'`; pending with a changed set still gives `'skeleton'`.
- `GroupBody` markup: a pending, reordered provider draws headers in the requested order with no skeleton. The provider test seam to mark it pending is chosen in the plan.
- `dropIndex`: one row (left of all, between two chips, past the end, empty space right of the last chip), two wrapped rows (start of row 2, above row 1, in the gap between rows), the dragged chip not counted, and a fixed point: lay out made-up widths greedily, move, lay out again, same index.
- `drag-state`: a second pointer is ignored; a release with no move is a tap; moving away and back commits nothing; Escape cancels; the dragged key leaving cancels; a new member appends to the preview; a release after a move commits `{ key, index }`; tap picks up, tap on another commits, tap on the same puts down.
- `orderByKeys`, `moveTarget` (each key, edges, other keys give `null`) and `statusText` (each state and its priority).
- `GroupMembers` markup: with two members, each has a button labeled "Move <name>, position <n> of 2" with `touch-none`; with one member, no handle.

Playwright (`e2e/group-reorder.spec.ts`, untracked made-up keys whose names start with "Birki"):

- Mouse drag with `page.mouse` in steps: the URL's `chars` order and the grid headers change, and while the navigation is held the dungeon and vault panels show no skeleton.
- Escape mid-drag: the URL doesn't change.
- ArrowRight on a focused handle: the URL changes and the handle stays focused.
- Tap one handle, then another: the order changes.
- Touch drag in a `hasTouch` context: the order changes and `window.scrollY` doesn't.
- A reload, and `/group` with no `chars`, keep the new order.

By hand (`npm run dev`, 1440 and 375 px): drag feel, five members wrapping at 375 px, and a phone or device emulation drag.

Not covered: real iOS long-press behaviour, and what each screen reader actually says.
