# Sort the Characters overview — plan

Spec: `docs/superpowers/specs/2026-10-17-sort-characters-design.md` (the authority). Issue #180. Branch `feat/sort-characters`, stacked on #186. TDD, one commit per task, `feat:` subjects.

1. `src/components/character-sort/characters-sort.ts` + test: options table, cookie name, `parseCharactersSort`.
2. `sort-cards.ts` + test: `sortCards` per spec "Options" (collator, nulls last, ties, progress via `bisSummary`).
3. `CharacterSort.tsx` + markup test; wire into `src/app/(home)/page.tsx` beside `ViewToggle`.
4. `e2e/character-sort.spec.ts`; capture screenshots per `docs/workflow.md` (ignored `e2e/pr-shots.spec.ts`), upload after the PR exists.

Gate: `npm run typecheck && npm run lint && npm test && npm run build`, plus `npx playwright test character-sort`.
