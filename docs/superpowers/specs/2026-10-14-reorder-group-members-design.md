# Reorder group members

Status: unattended spec. The owner chose drag and drop over move buttons on 2026-10-14; the rest follows the loop's defaults and is reviewed with the code in the pull request.
Date: 2026-10-14
Issues: #64

## Goal

Let the user change the order of members on the group page. The order is the order of keys in `?chars=` and in the `group` cookie (#44), and the grid's columns and the member chips follow it. Today the only way to change it is to remove members and add them back.

## Scope

In scope: dragging a member chip to a new place in the chip row, a keyboard way to do the same, touch support, and keeping the page steady while a reorder loads.

Out of scope:

- Dragging grid columns. The chip row is the one place that edits membership (`GroupEditsProvider`), and the grid already follows its order.
- A drag library. The interaction is a handful of pointer handlers; a dependency would need the owner's sign-off and buys nothing here.
- Server, schema or cookie changes. `getGroupPage` already keeps the URL's order (`selectGroup` filters, it never sorts), and `RememberGroup` writes whatever keys rendered.

## Interaction

**A grip handle on each chip.** When the group has two or more members, each chip in `GroupMembers` starts with a grip button (six dots, `aria-hidden` svg), before the avatar. The button is the drag source and the keyboard control, so the chip's name, avatar and remove button keep their own behavior, and a stray press on the chip never starts a drag. With one member the handle doesn't render: there is nothing to reorder.

**Pointer events, not HTML5 drag events.** HTML5 `draggable` fires no drag events for touch on Android Chrome, and on iOS it needs a long press with a system drag image we can't style. Pointer events handle mouse, pen and touch in one path:

- `pointerdown` on the handle (primary button only) calls `setPointerCapture`, records the member being dragged and copies the current order into a local preview.
- `pointermove` measures each chip's `getBoundingClientRect()` in preview order and asks `dropIndex` (below) where the pointer is. When the answer differs from the dragged chip's place in the preview, the preview moves it there, so chips slide aside live as the pointer passes them.
- `pointerup` commits: when the preview differs from the shared order, it calls `move(key, index)` on the shared membership, which navigates as add and remove do. `pointercancel`, `lostpointercapture` without a `pointerup`, and Escape drop the preview and change nothing.
- The handle has `touch-action: none`, so a touch drag on it doesn't scroll the page. The rest of the chip still scrolls normally.

**What the dragged chip looks like.** It lifts: a `ring-2 ring-gold` outline, `shadow-lg` and the `cursor-grabbing` cursor, and the other chips stay as they are. Shape and outline change as well as color, so it reads without color. A screen reader user drags with the keyboard instead (below).

**Keyboard.** The handle is a `<button>` with `aria-label="Move <name>, position <n> of <count>"` and `aria-describedby` pointing at one hidden hint, "Drag, or press the arrow keys to move." On a focused handle:

- ArrowLeft and ArrowUp move the member one place earlier, ArrowRight and ArrowDown one place later.
- Home moves it first, End last.
- A move at the edge (ArrowLeft on the first member) does nothing.

Each key press commits at once through `move`. React keeps a keyed element's DOM node when its position changes, so focus stays on the moved member's handle and repeated presses keep moving it. After a keyboard move, the existing `role="status"` region in `GroupMembers` says "<name> moved to position <n> of <count>." while the group updates, in place of `GROUP_UPDATING`; any other edit still says `GROUP_UPDATING`. The status text clears once the navigation finishes, as today.

**Clicks on the handle.** A press and release with no move changes nothing and doesn't navigate.

## Data flow

- **`moveMember(keys, key, toIndex)`** in `src/core/characters/member-key.ts`, beside `addMember` and `removeMember`. It returns a new array with `key` at `toIndex`, clamped to `0 … keys.length - 1`. An unknown key returns a copy unchanged.
- **`createGroupEdits`** gains `move: (key, toIndex) => apply(moveMember(current, key, toIndex))`. It composes against the asked-for membership like add and remove, so a move made while an add is loading keeps the added member. `apply` already skips a no-op.
- **`GroupEditsProvider`** exposes `move` on the context.
- **Chip order.** While a change loads, `GroupMembers` draws its rendered `members` in the order of the shared `keys` (`orderByKeys(members, keys)` in `group-members/order-by-keys.ts`): members present in `keys` in that order, then any not in `keys` (a removal still loading) in their rendered order. During a drag the local preview order wins. So the chip row shows the new order the moment a drag or key press commits, before the server answers.

## Keeping the page steady while a reorder loads

Today any pending edit skeletons the dungeon and vault panels, which is right for add and remove: both depend on every member. A reorder changes no member, so those panels stay as they are.

`groupBodyMode` gains a fourth input, `sameMembers`: true when the asked-for keys and the rendered keys hold the same set. With `pending && sameMembers && hasContent`, the mode is `'content'`, and `GroupBody` still hands `requestedKeys` to `GroupGrid`, whose `gridColumns` already draws real columns in the requested order. The panels show the old order until the server answers, which only changes the vault's list order.

## Files

- `src/core/characters/member-key.ts`: `moveMember`, with tests in `member-key.test.ts`.
- `src/components/group-edits/group-edits.ts` and `GroupEditsProvider.tsx`: `move`.
- `src/components/group-body/group-body-mode.ts` and `GroupBody.tsx`: `sameMembers`.
- `src/components/group-members/`:
  - `GroupMembers.tsx` renders `MemberChip`s in display order and keeps the status region.
  - `MemberChip.tsx`: one chip, with the handle when a reorder is possible.
  - `drop-index.ts`: `dropIndex(rects, dragged, point)`, a pure function.
  - `order-by-keys.ts`: `orderByKeys`.
  - `move-key.ts`: `moveTarget(key, index, count)`, mapping a key press to a target index or `null`.
  - `use-member-drag.ts`: the pointer state, a hook since it is client state and listeners.

## `dropIndex`

`dropIndex(rects, dragged, point)` takes the chips' rects in display order, the dragged chip's index and the pointer, and returns the index the dragged chip should take. Chips wrap (`flex-wrap`), so it reads in reading order. Among the other chips, it counts those the pointer is past: a chip is passed when its bottom is above the pointer, or when the pointer is within its row (`top ≤ y ≤ bottom`) and right of its horizontal center. The count is the target index. The pointer anywhere left of the first chip gives 0; past the last gives the last index.

ponytail: comparing to centers can flicker when a wide chip slides past a narrow one under a still pointer. Chips are close in width (name and spec), so this is a known ceiling; add hysteresis if it shows by hand.

## Testing

Unit tests, written first:

- `moveMember`: earlier, later, to the same place, clamped below 0 and past the end, unknown key.
- `group-edits`: `move` calls `onChange` with the new order, a no-op move doesn't, and a move after an add keeps the added key.
- `groupBodyMode`: pending with the same members and content gives `'content'`; pending with a changed set still gives `'skeleton'`.
- `dropIndex`: one row (left of all, between two chips, past the end), two wrapped rows (pointer on the second row's start, pointer above the first row), and the dragged chip's own rect not counted.
- `orderByKeys`: follows `keys`, then appends members missing from `keys`.
- `moveTarget`: each key, edges, and other keys giving `null`.
- `GroupMembers` markup: with two members, each has a button labeled "Move <name>, position <n> of 2" with `touch-action:none` (as the Tailwind class `touch-none`); with one member, no handle.

By hand (`npm run dev`, 1440 and 375 px):

- Mouse drag a chip past another: chips slide live, release reorders the grid columns and the URL, the dungeon and vault panels don't skeleton, and a reload keeps the order. `/group` with no `chars` reopens the new order from the cookie.
- Escape mid-drag puts the chip back.
- Touch drag on a phone (or device emulation) moves the chip without scrolling the page; scrolling from the chip's name still scrolls.
- Keyboard: Tab to a handle, arrows move it, focus stays, and a screen reader hears the position.

Not covered: no browser-level test of the drag itself until the Playwright tests (#35) land.
