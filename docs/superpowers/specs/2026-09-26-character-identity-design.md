# Character identity: avatars, race, faction and class icons

- **Status:** Draft for review
- **Date:** 2026-09-26
- **Issues:** #12 (class icon and faction badge in search results), #21 (character avatar)
- **Design:** the Characters, Character page, Group and Character search artboards on the design canvas

## Summary

Characters get a visual identity across the app:

- **Avatar:** the character's portrait, shown wherever the character appears.
- **Race:** shown with spec and class, for example "Troll Guardian Druid".
- **Faction:** shown as a badge on search results.

Search results show each character's class icon with a faction badge, so similar names are easy to tell apart.

## Goals

1. Show the character's avatar, in a class-colored ring, on the character page header, the character cards, and the group overview.
2. When a character has no avatar, show the class icon in the same ring instead.
3. Show race, spec and class together, for example "Troll Guardian Druid", on the character page and the character cards.
4. Show each search result's class icon with a faction badge on its corner, and the class and faction in text.

## Non-goals

- Race in search results. Raider.IO's search results don't include race.
- Copying avatar images into the app. The app links to Blizzard's image server, as it does for item icons.
- The group overview page itself, which is plan 3. This spec defines the shared avatar component that plan 3 uses.
- Faction badges outside search results.

## Data sources

| Data | Source | Field |
|---|---|---|
| Race | Blizzard profile, `/profile/wow/character/{realm}/{name}`, already fetched by each sync | `race.name`, for example "Troll" |
| Faction | The same Blizzard profile | `faction.type`: `HORDE` or `ALLIANCE` |
| Avatar | Blizzard character media, `/profile/wow/character/{realm}/{name}/character-media` | The `assets` entry with key `avatar` |
| Class icon | Blizzard playable class media, `/data/wow/media/playable-class/{classId}` | The `assets` entry with key `icon` |
| Search result class and faction | Raider.IO search, already used by the add bar | `class.name`, `faction` (`horde` or `alliance`) |

The character media endpoint returns only `avatar` and `main-raw`. There is no `inset` image.

## Data model

One migration:

| Change | Columns |
|---|---|
| `characters` gains | `race` (text, nullable), `faction` (text, nullable, `HORDE` or `ALLIANCE`), `avatar_url` (text, nullable) |
| New table `class_media` | `class_name` (text, primary key), `class_id` (integer), `icon_url` (text, nullable), `fetched_at` (integer) |

Existing characters get race, faction and avatar on their next sync. Until then they show the class icon fallback and "Guardian Druid" without race.

## Behavior

### Sync

- `BlizzardClient.getProfile` also returns `raceName` and `faction`.
- A new `BlizzardClient.getCharacterMedia(ref)` returns the avatar URL, or `null` when Blizzard has none, including a 404.
- The character syncer fetches profile, equipment and media in parallel. It saves race, faction and avatar URL with the other profile fields.
- A media failure never fails the sync. The character keeps the avatar URL it had, and gear still updates.
- The avatar URL is refreshed on every sync, because it changes when the character's appearance changes.

### Class icons

- A new `ensureClassIcons(deps, region)` fills `class_media` for all classes. It uses `getClasses` for the class IDs, then fetches each class's icon.
- Class icons change rarely, so the cache is refreshed every 30 days. On failure the app keeps what it has.
- Views and the search route look up icons by class name.

### Display text

- The identity line is race, spec and class joined by spaces, for example "Troll Guardian Druid". Missing parts are left out, so a character without race shows "Guardian Druid".
- The spec in the line follows the "Compare as" override, as the spec line does today.

### Search results

- The search route adds each result's faction and class icon URL.
  - Faction comes from Raider.IO.
  - The class icon comes from the `class_media` cache, by class name.
- If a class icon isn't known, the result shows the class-colored initial, as today.

## UI

### Shared components

- **`CharacterAvatar`** takes the avatar URL, class icon URL, class name, name and size.
  - It shows the avatar in a class-colored ring.
  - Without an avatar, it shows the class icon in the ring.
  - Without either, it shows the class-colored initial.
  - The image is decorative, because the name is always shown next to it.
- **`FactionBadge`** is a small shield icon: red for Horde, blue and gold for Alliance. Its `title` names the faction. Where it's used, the faction name also appears in text, so color is never the only cue.

### Where they appear

| Place | What changes |
|---|---|
| Character page header | `CharacterAvatar` at 76 px replaces the initial circle. The identity line reads "Troll Guardian Druid". |
| Character cards | `CharacterAvatar` at 52 px replaces the initial circle. The identity line reads "Troll Guardian Druid". |
| Search results | The class icon at 40 px with `FactionBadge` on its lower-right corner. Class and faction name in text on the right. |
| Group overview (plan 3) | `CharacterAvatar` on member chips, grid column headers, priority rows and Great Vault headers. |

## Error handling

| Failure | Behavior |
|---|---|
| Character media returns 404 or fails | Keep the previous avatar URL. Show the class icon fallback if there's none. The sync result is unaffected. |
| An avatar image fails to load in the browser | The browser shows the ring with an empty image. No retry logic. |
| Class media fetch fails | Keep cached icons. Search results fall back to the initial. |
| Raider.IO result without faction | Show no badge and no faction text. |

## Testing

- **Blizzard client:** the profile maps `raceName` and `faction`, `getCharacterMedia` returns the avatar URL, and it returns `null` on 404.
- **Sync:** it saves race, faction and avatar, and a media failure keeps the old avatar while gear still updates.
- **Class icon cache:** it fills from Blizzard, serves the cache for 30 days, and keeps the cache on failure.
- **Search:** results carry faction and the class icon URL, and an unknown class gets no icon.
- **Identity line:** race, spec and class join correctly, and missing parts are skipped.
- **Components:** `CharacterAvatar` renders the avatar, then the class icon, then the initial, and `FactionBadge` has the faction in its `title`.
- **Browser check:** your druid shows its avatar and "Troll Guardian Druid". A search shows class icons with faction badges.
