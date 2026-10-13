# Character page loader

Status: draft, waiting for owner approval. Revised on 2026-10-13 for the spec review's cold-click finding: a route skeleton alone shows nothing until Next has prefetched it, so the clicked link gets its own pending cue.
Date: 2026-10-13
Issue: #112. Show a loader when opening a character's page

## Goal

A click on a link to a character's page leaves the old page on screen until the new one has rendered. On a cold run that is a few seconds (#29 measured about 2.4 s for the first render), so the click feels dead.

Every click on a link to a character's page gives visible feedback within about 100 ms: the character page's skeleton when Next has it ready, otherwise a pending cue on the clicked link until the skeleton or the page arrives.

## Why this is open now

The skeleton loaders spec (#87, `2026-10-10-skeleton-loaders-design.md`) gave the character route no route skeleton. A browser probe showed that a loading boundary on that route either blanked the whole page or reloaded the document on every list-tab switch, because the tabs navigated to a new `?list=`. It left a page-load cue for the route to a later issue: this one.

That reason is gone. The list moved to spec settings (`354de55 feat: take the compared list from spec settings`), and the character page no longer navigates within its own route:

- The page reads only its path params, never search params.
- Its client actions (Refresh, settings, SimC paste, Remove, `StaleSync`, `BackgroundSync`, `AutoAddCharacter`) call `router.refresh()`, or `router.push` to another route.
- No `router.push` or `router.replace` targets the character route with new search params.

So the character route can take a route-level `loading.tsx`, the cue Next recommends, as `/` already does.

## Why the route skeleton isn't enough on its own

Next shows a `loading.tsx` fallback at once only after it has prefetched it. From the installed docs:

- `03-api-reference/03-file-conventions/loading.md`, Navigation: the fallback is prefetched, "making navigation immediate unless prefetching hasn't completed."
- `01-getting-started/04-linking-and-navigating.md`, Slow networks: on slow networks the fallback "may not appear immediately because it hasn't been prefetched yet," and `useLinkStatus` gives immediate feedback in that case.
- `02-components/link.md`, `prefetch`: a `Link` prefetches when it enters the viewport, and only in production. On the dev server every click is cold.

So a click soon after a link appears, on a slow connection, or on the dev server, still leaves the old page unchanged until the fallback arrives. The link cue covers that gap.

## What success looks like

The feedback contract, by navigation case:

| Case | First visible feedback |
|---|---|
| Warm click: production, the link's route already prefetched | The route skeleton, at once. No link cue. |
| Cold click: prefetch not finished (slow network, link just appeared, or dev server) | The link cue on the clicked link after 100 ms, then the route skeleton or the page when it arrives |
| Cached destination that renders at once (back/forward to a page still in the router cache) | The page itself. Neither the cue nor the skeleton is forced. |
| Direct URL: typed, reloaded, or opened in a new tab | The browser's own loading indicator until the first response; then the route skeleton, then the page. No in-app cue: there is no app on screen yet. |

And:

- It works from every link to a character's page:
  - The name on a character card on `/`.
  - A member's name and the "Import SimC" link in the group grid on `/group`.
  - The "Used by" character chips on a BiS list's editor page (`/settings/bis/[spec]`).
- The route skeleton sits below a real "← All characters" link, in the page's own `main` box.
- Actions on the character page never show the route skeleton: Refresh, settings changes, a SimC paste, a background sync finishing, and the untracked-character auto-add all keep the page on screen while they refresh.
- Screen readers hear one status line once the skeleton shows: "Loading character…". The link cue is visual only.
- With `prefers-reduced-motion`, neither the skeleton nor the cue animates. The cue still shows, as a static shape.
- Neither the cue nor the skeleton shifts the layout: the cue's box is always rendered and only its opacity changes, and the skeleton is the existing `CharacterPageSkeleton`.

## Scope

In scope: a route loading state for `/characters/[region]/[realm]/[name]`, and a pending cue on every link to it.

Out of scope:

- The group page's route skeleton. `/group` still navigates to a new `?chars=` on every edit, so the #87 reasoning still holds there.
- The BiS editor's route skeleton. Its list tabs navigate to a new `?list=`, the same pattern the #87 probe ruled out.
- Pending cues on links to other routes (main nav, settings, "All characters").
- Changing any link's `prefetch` setting.
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

### The link cue

`src/components/link-pending/LinkPending.tsx`, a client component that renders inside a `next/link` `Link`:

- It reads `useLinkStatus()` from `next/link`. Next sets `pending` only while the navigation that link started is blocked, before history updates. A prefetched route commits to its fallback at once, so `pending` is too short to show; a cold click stays pending until the fallback or the page arrives. Clicking another link moves the pending state to that link.
- It always renders the same `aria-hidden` box, a small ring in the link's own color (`currentColor`), sized to the link's text, `shrink-0`. Only its opacity changes: `opacity-0` when idle; `opacity-100` with a 100 ms transition delay when pending, so a fast navigation never flashes it. The ring spins with `animate-spin motion-reduce:animate-none`.
- The class choice is a pure function, `linkPendingClass(pending)`, in `link-pending/link-pending-class.ts`, so it is unit-tested without React.
- No new color token.

Where it goes, inside each existing `Link`, after the text. The links stay server-rendered; only the cue is a client component.

| Link | File | Placement |
|---|---|---|
| Card name | `character-card/CharacterCard.tsx` | After the name. The link becomes `inline-flex items-center gap-1.5` with the name in its own `truncate` span, so the cue never truncates away. |
| Member name | `group-grid/MemberHeader.tsx` | After the name span, inside the existing flex row. On phones the name is `sr-only`, so the cue sits beside the avatar. |
| "Import SimC" | `group-grid/MemberHeader.tsx` | After the text. |
| "Used by" chip | `bis-editor/EditorHeader.tsx` | After the name, inside the chip. |

The cue is visual only. A screen reader user hears the route skeleton's status once it shows; a status on every link would announce in every card and member header at once.

### Refreshes keep the page

`router.refresh()` runs as a transition and keeps the current UI, so it never shows a loading boundary. That is the behavior every action on the page relies on. The implement step confirms it by hand before writing anything else (see "Probe first").

### Comment updates

- `src/app/(home)/loading.tsx` says a boundary above "a character page" would break its search-param navigations. The character page has none now; the comment keeps only `/group`.
- `CharacterPageSkeleton`'s doc comment stays: "The character page below the back link. The caller owns the status line." Both callers, the route skeleton and `AutoAddCharacter`, own their status line.

### Probe first

The #87 probe found Next's loading boundaries behaving in ways the docs don't predict. Before the implementation, the implement step adds `loading.tsx`, the cue on the card name only, and a temporary 2 s delay in the page. It then runs these cases and records, for each, the time from click to first visible feedback and what that feedback was. It doesn't just record how long the page took to render.

On a production build (`npm run build`, then `npx next start -p 3001`, with dev stopped):

1. **Warm click:** load `/` with no throttling, wait until the network panel shows the character route's prefetch finished, then click a card. Expect the skeleton at once, no cue, and the same document (no full reload).
2. **Cold click:** throttle to Slow 4G, reload `/`, and click a card as soon as it renders, before its prefetch finishes. Expect the cue within about 100 ms, then the skeleton or the page. Also expect no full reload.
3. **Cached destination:** open a character, go back to `/`, then forward. Record whether it shows the page at once, or the skeleton; neither the cue nor the skeleton may be forced on an instant render.
4. **Direct URL:** type a character's URL into the address bar and load it. Record what shows before the page. No in-app cue is expected.
5. **Refresh keeps the page:** on a character page, use Refresh, change a setting and paste SimC. The page stays on screen; the skeleton never shows.
6. **Untracked character:** open an untracked character's path. Expect the route skeleton, then the "Adding…" line with `CharacterPageSkeleton` from `AutoAddCharacter`, then the page, with no blank between them.

On the dev server, repeat 2 and 5: every click there is cold, so the cue shows on each.

If any case fails its expectation, stop and bring the result to the owner before going on. If the route skeleton itself misbehaves (cases 1, 5 or 6), the fallback is a client-side cue: a provider that marks the clicked link pending through `useTransition` and shows `CharacterPageSkeleton` in place of the current page, like the group-edit pattern in `GroupEditsProvider`.

## Testing

- **Unit, `link-pending-class.test.ts`:** idle gives `opacity-0` with no delay; pending gives `opacity-100` with the 100 ms delay; both keep the same size classes and `motion-reduce:animate-none`.
- **Render, `LinkPending`** inside a `Link`, statically: one `aria-hidden` element, idle classes, no `role="status"`.
- **Render, `loading.test.ts`** beside the new `loading.tsx`, following `src/app/(home)/loading.test.ts`:
  - Exactly one `role="status"`, with "Loading character…".
  - The "All characters" link to `/` renders.
  - The gear table, dungeon and vault skeletons render (one known element per section is enough).
- **Render, the four links:** `CharacterCard`, `MemberHeader` (with and without crests) and `EditorHeader` each render the cue inside the character link, and the card name still truncates in its own span.
- **Hand checks, local:** the six probe cases above, now on the finished code, plus:
  - Open a character from a member header and from "Import SimC" on `/group`, and from a "Used by" chip on a BiS editor page, both warm and cold. Each gives the expected feedback.
  - Click one card cold, then another before the first lands. Only the second link shows the cue, and its page wins.
  - Edit the group on `/group` and switch list tabs in the BiS editor. Neither shows any route skeleton or reloads the document (no regression from #87).
  - Reduced motion on: the skeleton doesn't pulse and the cue doesn't spin, but the cue still shows.
- **Not covered:**
  - No browser-level tests, so the boundary's behavior and the cue's timing are checked by hand only.
  - `useLinkStatus` can't be forced pending in a static render. The pending branch is covered by `linkPendingClass` and by hand.
  - Static markup can't show a screen reader's announcements; the render test checks the single status line.
