# Character page loader

Status: draft, waiting for owner approval.
Date: 2026-10-13
Issue: #112. Show a loader when opening a character's page

## Goal

A click on a link to a character's page leaves the old page on screen until the new one has rendered. On a cold run that is a few seconds (#29 measured about 2.4 s for the first render), so the click feels dead.

Every navigation to a character's page shows the character page's skeleton at once, then the page.

## Why this is open now

The skeleton loaders spec (#87, `2026-10-10-skeleton-loaders-design.md`) gave the character route no route skeleton. A browser probe showed that a loading boundary on that route either blanked the whole page or reloaded the document on every list-tab switch, because the tabs navigated to a new `?list=`. It left a page-load cue for the route to a later issue: this one.

That reason is gone. The list moved to spec settings (`354de55 feat: take the compared list from spec settings`), and the character page no longer navigates within its own route:

- The page reads only its path params, never search params.
- Its client actions (Refresh, settings, SimC paste, Remove, `StaleSync`, `BackgroundSync`, `AutoAddCharacter`) call `router.refresh()`, or `router.push` to another route.
- No `router.push` or `router.replace` targets the character route with new search params.

So the character route can take a route-level `loading.tsx`, the cue Next recommends, as `/` already does.

## What success looks like

- Clicking any link to a character's page shows the character page skeleton at once, below a real "← All characters" link, then the page.
- It works from every entry point without per-link code:
  - The name on a character card on `/`.
  - A member's name and the "Import SimC" link in the group grid on `/group`.
  - The "Used by" character chips on a BiS list's editor page (`/settings/bis/[spec]`).
  - Back and forward, and a typed URL.
- Actions on the character page never show the route skeleton: Refresh, settings changes, a SimC paste, a background sync finishing, and the untracked-character auto-add all keep the page on screen while they refresh.
- Screen readers hear one status line: "Loading character…".
- With `prefers-reduced-motion`, the skeleton doesn't pulse (the `Skeleton` primitive already handles it).
- When the page lands, it doesn't jump by much: the skeleton is the existing `CharacterPageSkeleton`, inside the page's own `main` box.

## Scope

In scope: a route loading state for `/characters/[region]/[realm]/[name]`.

Out of scope:

- The group page's route skeleton. `/group` still navigates to a new `?chars=` on every edit, so the #87 reasoning still holds there.
- The BiS editor's route skeleton. Its list tabs navigate to a new `?list=`, the same pattern the #87 probe ruled out.
- Spinners or pending states on the links themselves (`useLinkStatus`). The route skeleton makes them redundant.
- The add bar. Picking a search result adds the character and refreshes `/`; it doesn't open the character page (#29 and #87 covered its feedback).
- No schema change, no migration, no cache version bump.

## Design

### The route skeleton

`src/app/characters/[region]/[realm]/[name]/loading.tsx`:

- The same `main` element and classes as the page: `mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16`.
- The real `<Link href="/">← All characters</Link>`, so the user can leave while waiting.
- One `<p role="status" className="sr-only">` with `CHARACTER_LOADING`.
- `CharacterPageSkeleton` below it, with no heading.

A loading file gets no params, so the skeleton can't show the name. Shapes only, as on `/`.

`CHARACTER_LOADING = 'Loading character…'` joins the other strings in `src/components/shared/loading-copy.ts`.

### Where the boundary sits

Beside the character page, not at `src/app/characters/`. The #87 probe found a boundary one level above a page caused full document reloads, and there is nothing else under `src/app/characters/` for it to cover.

### Refreshes keep the page

`router.refresh()` runs as a transition and keeps the current UI, so it never shows a loading boundary. That is the behavior every action on the page relies on. The implement step confirms it by hand before writing anything else (see "Probe first").

### Comment updates

- `src/app/(home)/loading.tsx` says a boundary above "a character page" would break its search-param navigations. The character page has none now; the comment keeps only `/group`.
- `CharacterPageSkeleton`'s doc comment stays: "The character page below the back link. The caller owns the status line." Both callers, the route skeleton and `AutoAddCharacter`, own their status line.

### Probe first

The #87 probe found Next's loading boundaries behaving in ways the docs don't predict. Before the implementation, the implement step adds `loading.tsx` with a temporary 2 s delay in the page and checks, on the dev server and on a production build (`npm run build`, then `npx next start -p 3001`, with dev stopped):

1. A click on a character card shows the skeleton at once, in the same document (no full reload).
2. Refresh, a settings change and a SimC paste on the character page keep the page on screen; the skeleton never shows.
3. Opening an untracked character's path shows the route skeleton, then the "Adding…" line and `CharacterPageSkeleton` from `AutoAddCharacter`, then the page, with no blank between them.

If any of these fails, stop and bring the result to the owner before going on. The fallback is a client-side cue: a provider that marks the clicked link pending through `useTransition` and shows `CharacterPageSkeleton` in place of the current page, like the group-edit pattern in `GroupEditsProvider`. It needs a client link component at every entry point, so it is not the first choice.

## Testing

- **Render, `loading.test.ts`** beside the new `loading.tsx`, following `src/app/(home)/loading.test.ts`:
  - Exactly one `role="status"`, with "Loading character…".
  - The "All characters" link to `/` renders.
  - The gear table, dungeon and vault skeletons render (one `role` check or a known class per section is enough).
- **Hand checks, local, with dev tools throttling the network to Slow 4G,** on dev and on a production build:
  - Open a character from a card on `/`, from a member header and the "Import SimC" link on `/group`, and from a "Used by" chip on a BiS editor page. Each shows the skeleton at once, then the page.
  - Back from the character page to `/`, then forward. Forward shows the skeleton, or the cached page at once.
  - On a character page: Refresh, change a setting, paste SimC. The page never blanks.
  - Open an untracked character's path: route skeleton, then "Adding…" with the page skeleton, then the page.
  - Edit the group on `/group` and switch list tabs in the BiS editor. Neither shows any route skeleton or reloads the document (no regression from #87).
  - Reduced motion on: the skeleton doesn't pulse.
- **Not covered:**
  - No browser-level tests, so the boundary's behavior on navigation and refresh is checked by hand only.
  - Static markup can't show a screen reader's announcements; the render test checks the single status line.
