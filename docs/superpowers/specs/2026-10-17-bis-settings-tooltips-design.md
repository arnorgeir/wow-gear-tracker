# BiS settings: flag only edited lists, descriptions in tooltips

Issue: #182 (S, `area: character`).

## Problem

The BiS settings views say "no edits" on every list nobody touched: the editor's list tabs (desktop and phone) and the tracked spec cards on `/settings/bis`. The word is noise; only an edited list is worth flagging. The editor's Comparison section also prints a description under each of its three settings (BiS source, Compare against, Tier pieces), which takes room on every visit for text read once.

## Decisions

### 1. "no edits" goes away everywhere

`editedText(count)` in `src/components/shared/edited-text.ts` returns `null` for 0 and `"N edited"` otherwise. Every caller renders nothing for `null`:

| Caller | Unedited, today | Unedited, after |
|---|---|---|
| `ListTabs` desktop tab | `Heroic  no edits` | `Heroic` |
| `ListTabs` phone tab second line (`tabSub`) | `no edits` / `Compared · no edits` | empty / `Compared` |
| `TrackedCard` lines | `Method · Compares Mythic+ · no edits` | `Method · Compares Mythic+` |
| `badgeText` | already `null` at 0 | unchanged, drops its own guard |

`tabSub(count, compared)` returns `string | null`: `Compared · 3 edited`, `Compared`, `3 edited`, or `null`. The phone tab renders the second line only when it is not `null`. Phone tabs sit in one grid row and stack from the top, so names stay aligned; one tab is always the compared one, so the row keeps its two-line height.

Fixing it in the shared function, not in each caller, keeps the tabs and the cards consistent. The issue names both callers.

### 2. Descriptions move into an info tooltip beside each title

A new component, `src/components/info-tip/InfoTip.tsx` (client), renders a small round "i" button after a section title and a popover holding the description.

The repo has no tooltip component. It has one popover, `CellDetails`, which uses the native `popover` attribute: Escape and outside clicks close it, and the browser handles the top layer. `InfoTip` uses the same native popover, and no new dependency.

The owner answered the open question: the tooltip must work on touch and keyboard, not only hover.

| Input | Behaviour |
|---|---|
| Mouse | Hovering the button opens the tip. It stays open while the pointer is on the button or on the tip, and closes 200 ms after the pointer has left both, so the pointer can cross the gap to the tip (WCAG 1.4.13, hoverable). A mouse click while the tip is open does nothing (its default is prevented), so a click never closes a tip the hover just opened; a click while it is closed opens it, so hover, Escape, then a click without moving still works. |
| Touch | Tap toggles it (`popoverTarget`). Tapping elsewhere or another tip closes it (`popover="auto"` light dismiss). |
| Keyboard | Tab reaches the button; Enter or Space toggles; Escape closes. Focus stays on the button. |
| Screen reader | The button's name is `About <title>` (e.g. "About BiS source"). The BiS source and Compare against fieldsets, and the Tier pieces checkbox itself, carry `aria-describedby` pointing at the tip, so the description is still read with the controls even while the tip is closed. `popoverTarget` gives the button `aria-expanded`. |

Placement: on open, and on every window resize or scroll while it is open (as `CellDetails` already does for resize), the tip is placed below the button, or above when there is no room, clamped inside the viewport. That is `placeBeside` from `src/components/cell-details/position.ts`. It moves to `src/components/shared/popover-position.ts` with its test, since two components now use it (AGENTS.md "Splitting code"); `CellDetails` imports it from there. The tip is at most 18rem wide and never wider than the viewport minus 16 px.

The button is 20 px visually with a 44 px hit area on phones (padding plus negative margin), so it doesn't push the title's line height.

Text in the tips, unchanged from today:

- BiS source: "Where this spec's list comes from. Manual copies the current list for you to edit."
- Compare against: "Characters of this spec compare their gear against this list. Saved as you choose."
- Tier pieces: "Uncheck if the set bonus is all that matters for this spec."

### 3. The Tier pieces title shows on phones

The "Tier pieces" title is hidden below `md` today; its description was the only explanation on a phone. With the description in a tooltip, the title shows at every width so the tip has a place to sit, as the other two settings already do.

`SourcePicker` also appears on the "no list yet" page (`/settings/bis/[spec]` without lists). It gets the same tooltip there; the component is shared.

## Out of scope

- The intro paragraph on `/settings/bis` (`SpecPicker`) stays as it is.
- Other places that explain themselves inline.

## Acceptance

1. An unedited list tab shows no edit text on desktop; an edited one shows "N edited".
2. On a phone, the compared tab's second line reads "Compared" when unedited and "Compared · N edited" when edited; other unedited tabs have no second line.
3. Tracked spec cards drop " · no edits" when unedited.
4. BiS source, Compare against and Tier pieces show no description text under them; each title has an "i" button.
5. Hover (mouse), tap and Enter/Space each open the tip; Escape, outside tap, and leaving both button and tip close it as the table says. Moving the mouse from the button onto the tip keeps it open. Hover, Escape, then a click without moving reopens it.
6. A tip left open through a resize, phone rotation or scroll stays next to its button and inside the viewport.
7. Screen readers get the description through `aria-describedby`.
8. Unit tests: `editedText`, `tabSub`, and the moved `placeBeside`.

## Review

Spec review by Codex (GPT-6 Astra, Medium). S.1 (hover content reachable), S.2 (mouse click on a closed tip) and S.3 (placement while open) are resolved above. The review's note that a group description doesn't reach each control is resolved by describing the Tier pieces checkbox directly.
