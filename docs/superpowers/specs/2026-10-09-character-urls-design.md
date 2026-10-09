# Raider.IO-style character URLs

Status: design approved in chat on 2026-10-09.
Date: 2026-10-09
Issue: #102. Raider.IO-style character URLs: /characters/<region>/<realm>/<name>

## Goal

Character pages use the database ID: `/characters/2`. That path means nothing to a reader, points at a different character on another install, and breaks when the local database is rebuilt.

Character pages move to `/characters/<region>/<realm>/<name>`, for example `/characters/eu/tarren-mill/rust%C3%BD`. A friend can open the same link on their own install, and the page tracks the character there if it isn't tracked yet.

## What success looks like

- Every link to a character page uses the new path: the character card, both links in the group grid's member header, and the list tabs.
- A path matches whatever its case. `/characters/EU/Tarren-Mill/RUSTÝ` and `/characters/eu/tarren-mill/rust%C3%BD` open the same character.
- A path for a character that isn't tracked adds it with no click, then shows its page at the same URL.
- A path for a character Blizzard doesn't know shows Blizzard's message and a link back to the list. Nothing is stored.
- `/characters/2` returns 404.
- Opening a page never writes on `GET`. The add goes through the guarded `POST /api/characters`.

## Scope

In scope: the page route, the lookup, the auto-add state, and every link to a character page.

Out of scope:

- API routes keep numeric IDs (`/api/characters/[id]`, `/sync`, `/simc`). Nobody shares them, and the page already knows the ID once it has loaded.
- No redirect from `/characters/<id>`. IDs never left the owner's machine except in their own bookmarks.
- No schema change and no migration.

## Design

### Identity and paths

The group page already names characters by identity instead of by row: `MemberKey` in `src/core/characters/member-key.ts` is `{ region, realmSlug, nameKey }`. The realm slug is Blizzard's, stored on the character, never Raider.IO's (see `AGENTS.md`, external data facts). The name key comes from `nameKeyOf`: lowercased with English locale rules, accents kept. Character paths reuse all of it.

- **`characterHref({ region, realmSlug, name })`** returns `/characters/${region}/${realmSlug}/${encodeURIComponent(nameKeyOf(name))}`. The path holds the name key, so links are lowercase, as in the issue's example.
- **`memberKeyFromParts(region, realmSlug, name)`** holds the validation now inside `parseMemberKey`: the region is one of `REGIONS`, the slug matches `SLUG` and the name matches `NAME`, all after lowercasing. It returns a `MemberKey` or `null`. `parseMemberKey` splits on `.` and calls it, so group keys and paths share one rule.
- **Segments are decoded tolerantly.** The page passes each route segment through `decodeURIComponent` inside a `try`, as `decodeGroupCookie` does, and a segment that won't decode is a 404. Names and slugs never contain `%`, so decoding a segment Next already decoded changes nothing. The plan checks Next's param decoding in `node_modules/next/dist/docs/` and keeps this step either way.

### Lookup

- **`findCharacterByKey(db, key)`** in `src/core/db/queries/characters.ts` returns the row whose `region`, `realm_slug` and `name_key` match, or `undefined`. Blizzard realm slugs are unique within a region. The identity index is on `realm_id`, not the slug, and a full scan of a few dozen rows is fine.
- **`getCharacterPage(services, key, listType)`** in `src/server/views/character-page.ts` takes a `MemberKey` instead of an ID. It returns one of:
  - the full `CharacterPageView`, as today, when the character is tracked
  - `{ status: 'untracked', region, realmSlug, name }` when it isn't, with `name` as the path's name key
- The page renders `notFound()` when `memberKeyFromParts` returns `null`.

### Untracked: auto-add

Adding while the page renders would be a write on `GET`, which the request guard lets through. Any website could then make the owner's browser request a character path, for example in a hidden image, and each request would add a character and call Blizzard. So the add runs from the client, through the guarded route.

- **`src/components/auto-add-character/AutoAddCharacter.tsx`** is a client component. It shows "Adding rustý – tarren-mill…".
- On mount it POSTs `{ region, realmSlug, name }` to the existing `POST /api/characters`, which already accepts a realm slug. The request uses `useApiAction` from `src/components/hooks/use-api-action.ts`. It then calls `router.refresh()`, so the server renders the tracked page at the same URL.
- A ref guards the effect, so Strict Mode's second mount in development doesn't send a second POST. `addCharacter` is idempotent anyway, but the guard saves a Blizzard call.
- On failure it shows the error text in place of the progress line, with a link back to `/`. A `UserError` reads, for example, "Blizzard can’t find rustý on that realm." A renamed or transferred character reaches this state too and gets the same message.
- When configuration is missing, `getServices` throws first and the page shows `SetupNotice`, as today.

### Links

Views compute the path on the server, and components render it. Components stop building paths from an ID.

- `CharacterSummary` and `GroupMemberView` in `src/server/views/types.ts` gain `href: string`, set with `characterHref`.
- `CharacterCard` and `MemberHeader` (both links: the name, and **Import SimC**) use `href`.
- `ListTabs` takes `href` instead of `id` and links to `${href}?list=${l}`.
- Components that call API routes (`SimcPaste`, `CharacterSettings`, `RefreshButton`, `StaleSync`, `RemoveCharacterButton`) keep using the ID.

### Old route

`src/app/characters/[id]/` is deleted, and its page moves to `src/app/characters/[region]/[realm]/[name]/page.tsx`. A one-segment path like `/characters/2` matches no route and gets 404. `isActiveLink` in `src/components/main-nav/active-link.ts` checks `startsWith('/characters')`, so the nav still highlights the list tab.

## Testing

- **Unit, `member-key.test.ts`:**
  - `characterHref` encodes `Rustý` and lowercases it.
  - `memberKeyFromParts` accepts uppercase and accented input, and rejects a bad region, a bad slug, or a name containing digits or dots.
  - A round trip from `characterHref` through decode and `memberKeyFromParts` gives back the original key.
- **Query:** `findCharacterByKey` finds a row by an uppercase name and returns `undefined` for another realm with the same name.
- **Loader, `views.test.ts`:** `getCharacterPage` returns the full view with `href` for a tracked key, and `untracked` for an unknown key. Card and group views carry `href`.
- **Hand check, by the owner:**
  - Open a tracked character's path from a card, a group header and a list tab.
  - Open an untracked path and watch it add itself.
  - Open a misspelled name and see Blizzard's message.
  - Confirm `/characters/2` gets 404.
- **Not covered:** no browser-level tests, so the auto-add effect and its Strict Mode guard are checked by hand only.
