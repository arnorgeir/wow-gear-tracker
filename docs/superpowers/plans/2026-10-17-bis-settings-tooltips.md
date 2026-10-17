# BiS settings tooltips: implementation plan

Spec: `docs/superpowers/specs/2026-10-17-bis-settings-tooltips-design.md`. Issue #182. Branch `feat/bis-settings-tooltips`, worktree `C:\workspace\wgt-182`.

Each task: failing test first where there is logic, then code, then `npm test` for the touched files. One commit per task, `feat:` or `chore:` subject, terse, no AI attribution.

## Task 1: `editedText` returns null for no edits

Files: `src/components/shared/edited-text.ts`, `edited-text.test.ts`, `src/components/bis-editor/editor-text.ts`, `editor-text.test.ts`, `ListTabs.tsx`, `src/components/spec-picker/TrackedCard.tsx`, `src/components/bis-source-badge/badge-text.ts`.

1. Tests: `editedText(0)` is `null`, `editedText(3)` is `'3 edited'`. `tabSub(0, false)` is `null`, `tabSub(0, true)` is `'Compared'`, `tabSub(3, false)` is `'3 edited'`, `tabSub(3, true)` is `'Compared · 3 edited'`. Run, watch fail.
2. `editedText = (count: number): string | null => (count === 0 ? null : \`${count} edited\`)`. Update doc comment.
3. `tabSub`: join the non-null parts of `['Compared' if compared, editedText(count)]` with ` · `, or `null` when none.
4. `ListTabs`: desktop renders the edit span only when `editedText(...)` is not null; phone renders the second-line span only when `tabSub(...)` is not null.
5. `TrackedCard`: append ` · {edited}` only when not null, on both lines.
6. `badgeText`: `edited: editedText(editedCount)`.
7. Check the `badgeText` test still passes.

## Task 2: move `placeBeside` to shared

1. `git mv src/components/cell-details/position.ts src/components/shared/popover-position.ts` and the test alongside. Fix the test's import and `CellDetails.tsx`'s import (`@/components/shared/popover-position`).
2. `npm test` green. Commit `chore: share popover placement`.

## Task 3: `InfoTip` component

File: `src/components/info-tip/InfoTip.tsx` (`'use client'`).

Props: `{ id: string; title: string; children: ReactNode }`. Each caller makes `id` with `useId()` and uses the same id in `aria-describedby`.

Markup (both elements are `span`s, since the tip sits inside a `<legend>`, which takes phrasing content only):

```tsx
<span className="inline-flex" onPointerEnter={mouseOnly(open)} onPointerLeave={mouseOnly(closeSoon)}>
  <button type="button" ref={button} popoverTarget={id} aria-label={`About ${title}`} onClick={onClick}
    className="-m-3 inline-flex size-11 items-center justify-center text-muted hover:text-ink md:-m-1 md:size-7">
    <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full border border-line-strong text-xs font-bold normal-case">i</span>
  </button>
  <span id={id} ref={tip} popover="auto" onToggle={onToggle} onPointerEnter={mouseOnly(open)} onPointerLeave={mouseOnly(closeSoon)}
    className="fixed m-0 w-max max-w-[min(18rem,calc(100vw-16px))] rounded-lg border border-line-strong bg-surface p-3 text-sm font-normal normal-case tracking-normal text-ink shadow-2xl">
    {children}
  </span>
</span>
```

Wiring:

- `mouseOnly(fn)` wraps a pointer handler and runs `fn` only for `e.pointerType === 'mouse'`; touch taps go through `popoverTarget`.
- `open`: cancel any pending close timer; `showPopover()` unless `:popover-open`.
- `closeSoon`: start a 200 ms timer that calls `hidePopover()` if still open. Entering the button or the tip cancels it (spec S.1). Clear the timer on unmount.
- `onClick`: when `e.nativeEvent.pointerType === 'mouse'` and the tip is open, `preventDefault()` so the click doesn't toggle it closed; otherwise let `popoverTarget` toggle it (spec S.2).
- `place()`: `placeBeside(button rect, tip rect, { width: innerWidth, height: innerHeight })` from `@/components/shared/popover-position`, setting `style.top/left` in px.
- `onToggle`: on open, `place()`; on close, clear `top/left` and any timer.
- `useEffect`: `resize` listener and `scroll` listener (capture, passive) that call `place()` while the tip is `:popover-open` (spec S.3).
- The tip resets uppercase and tracking so the legend's heading styles don't leak in.

The branching is browser wiring; `placeBeside` is already tested (Task 2). Verify behaviour by hand (Task 5).

## Task 4: use `InfoTip` in the three settings

- `SourcePicker`: `const tipId = useId();`. Legend becomes `<legend className={HEADING}><span className="inline-flex items-center gap-1.5">BiS source<InfoTip id={tipId} title="BiS source">Where this spec&apos;s list comes from. Manual copies the current list for you to edit.</InfoTip></span></legend>`. Fieldset gets `aria-describedby={tipId}`. Remove the description span.
- `CompareAgainst`: same pattern, text "Characters of this spec compare their gear against this list. Saved as you choose."
- `StatsMatter`: the title span drops `hidden md:block` (shows at every width) and holds the `InfoTip` with "Uncheck if the set bonus is all that matters for this spec."; the checkbox gets `aria-describedby={tipId}`; the description `<p>` goes.

Commit `feat: move bis setting descriptions into tooltips`.

## Task 5: gate and hand check

1. `npm run typecheck && npm run lint && npm test`, then `npm run build` in the worktree.
2. Hand check with the e2e harness or `npm run dev -- -p 3001` (copy of `.env` and `data/app.db` needed for dev): hover and move onto the tip, hover + Escape + click, tap with mobile emulation, keyboard Tab + Enter + Escape, resize while open, width 390 px.
