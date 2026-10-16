# Characters list view: implementation plan

Spec: `docs/superpowers/specs/2026-10-14-characters-list-view-design.md` (the authority; read it first).
Issue: #150. Branch: `feat/characters-list-view`.

TDD for every task: write the failing test, run it (`npx vitest run <file>`), then the code. One commit per task, `feat:`/`chore:` subjects per AGENTS.md, no AI attribution.

## Task 1: move `bis-summary.ts` to `shared/`

- `git mv src/components/character-card/bis-summary.ts src/components/shared/bis-summary.ts`, same for its test.
- Update imports in `CharacterCard.tsx` (and anything else `grep -rn bis-summary src` finds) to `@/components/shared/bis-summary`.
- Tests stay green. Commit `chore: move bis summary to shared components`.

## Task 2: `sourceText` and `BisBar`

- `src/components/shared/source-text.ts`: `sourceText(card: Pick<CharacterCardView, 'snapshot' | 'sourceAt'>, now: number): string`, the exact logic now inline in `CharacterCard`. Test the three strings in `source-text.test.ts` (simc, blizzard, not synced).
- `src/components/bis-bar/BisBar.tsx`: takes `{ bar: ReturnType<typeof barSegments> }` (export a type from `bis-summary.ts` if cleaner) and renders today's bar markup with its comment. Small test in `BisBar.test.ts`: five segments, `aria-hidden`.
- `CharacterCard` uses both. Existing `CharacterCard` tests stay green. Commit `chore: share bis bar and source text`.

## Task 3: view preference helpers

- `src/components/view-toggle/characters-view.ts`: `CHARACTERS_VIEW_COOKIE = 'characters-view'`, `type CharactersView = 'grid' | 'list'`, `parseCharactersView(value?: string): CharactersView`.
- Test: `list` gives `list`; `grid`, `undefined`, `''`, `LIST`, junk give `grid`.

## Task 4: `CharacterRow` and skeletons

- `src/components/character-row/CharacterRow.tsx`, `CharacterRowSkeleton.tsx`, `RowProgressSkeleton.tsx` per the spec's "List row": three flex children (identity, progress, footer), stacked below `lg`, one line from `lg` with `lg:w-64` identity, `grow min-w-0` progress, `shrink-0` footer with `lg:w-40` right-aligned source text. 40 px `CharacterAvatar` without `classBadge`. Name link with `LinkPending` and `truncate` span, as the card does. Same `notFound` / `bisError` / loading / `tracksLoading` / error branches and status copy as the card; no crest chips.
- `CharacterRow.test.ts`, modelled on `CharacterCard.test.ts` (reuse its `card()` factory shape; `vi.mock('next/navigation')`): cases listed in the spec's Testing section.
- Commit `feat: add character list row`.

## Task 5: `CharacterGrid` view prop

- Add `view: CharactersView`. `list`: `flex flex-col gap-3` and `CharacterRowSkeleton`. `grid`: unchanged.
- Extend `CharacterGrid.test.ts` with a list case and a list-while-adding case (wrap in `PendingCharacterProvider`; check how its existing test sets a pending name, or check `PendingCharacterProvider` for an initial value. If none, cover adding by the row skeleton test alone and say so in the PR).

## Task 6: `ViewToggle`

- `src/components/view-toggle/ViewToggle.tsx`, `'use client'`, per the spec's "Toggle": `useOptimistic(view)` + `useTransition`; on change inside `startTransition`: set optimistic, `document.cookie = ...`, `router.refresh()`. `aria-busy` and `opacity-60` while pending. Segmented style from `SourcePicker` at `h-9`. Small inline SVG icons, `aria-hidden`, beside the words "Grid" and "List".
- `ViewToggle.test.ts` (mock `next/navigation`): two radios, labels, given view `checked`, `sr-only` legend "Layout".

## Task 7: page

- `src/app/(home)/page.tsx`: `const view = parseCharactersView((await cookies()).get(CHARACTERS_VIEW_COOKIE)?.value)`. Legend row `flex flex-wrap items-center justify-between gap-4` with `StateLegend` and, when `cards.length > 0`, `ViewToggle`. `CharacterGrid view={view}`; map to `CharacterRow` or `CharacterCard`.
- `loading.tsx` unchanged.
- Commit `feat: switch characters overview between grid and list`.

## Gate

`npm run typecheck && npm run lint && npm test && npm run build` in this worktree (its own `.next`; safe while the main checkout's dev server runs).
