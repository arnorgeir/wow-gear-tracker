# Character page dungeon rows match the group page

Status: design approved in chat on 2026-10-11.
Date: 2026-10-11
Issue: #80. Match the character page's dungeon priority headers to the group page

## Goal

On the character page, Dungeon priority lists each dungeon as a plain name and score, with every dungeon's items shown below it. The group page shows each dungeon as a collapsible row with its rank, a thumbnail, the name and the score. The two pages should look the same and work the same way.

The character page takes the group page's row: rank, thumbnail, name and score in a native disclosure. Both pages share one component for it.

## What success looks like

- Each character page dungeon is a `<details>` row with rank, thumbnail, name and gold score in the summary, styled like the group page's row.
- Rank 1 starts open. Every other dungeon starts closed. This matches the group page.
- The body of an open row holds what the character page shows today: the split-dungeon note, if any, then one `ItemCard` or "Any item" line per credit.
- A missing or broken thumbnail image falls back to the short-name tile, as on the group page.
- The group page renders the same as before.
- Credits, scores, ordering, notices and wording do not change. Empty, failed, loading and "Nothing you need from" states do not change.
- Keyboard and screen-reader behaviour match the group page: `summary` is focusable with the gold `focus-visible` outline, Enter and Space toggle it, and the dungeon name is an `h3`.

## Scope

In scope: the character page's dungeon rows, the shared row component, the character page view's dungeon art, and the matching skeleton.

Out of scope:

- A summary line on the character page, such as a credit count. That would be new wording.
- Remembering which rows are open across navigation or list switches.
- Any change to the group page's look or behaviour.

## Design

### Data

`DungeonPriorityView` in `src/server/views/types.ts` gains `shortName: string` and `imageUrl: string | null`, the same fields as `GroupDungeonView`.

`getCharacterPage` in `src/server/views/character-page.ts` fills them with `dungeonArt(season.dungeons, d.challengeModeId)` from `src/server/views/dungeon-art.ts`, the same way `group-page.ts` does. `dungeonArt` already returns `''` and `null` when the season has no art for a dungeon.

### Components

- **`src/components/dungeon-thumbnail/`**: `DungeonThumbnail.tsx`, `thumbnail-label.ts` and `thumbnail-label.test.ts` move here unchanged from `group-priority/`. Two components now import the thumbnail, so it gets its own directory under the project rules.
- **`src/components/dungeon-disclosure/DungeonDisclosure.tsx`** (new): the `<details>` shell taken from today's `group-priority/DungeonRow.tsx`. Props: `rank`, `name`, `score`, `imageUrl`, `shortName`, an optional `summaryExtra` node and `children` for the body. The summary holds the rank, the thumbnail, the `h3` name with the score (and its sr-only "Score " prefix and `title`), then `summaryExtra` under the name line, then the chevron. `open={rank === 1}`. Classes, focus outline and the hidden WebKit marker stay exactly as in `DungeonRow` today. It stays a server component; only `DungeonThumbnail` is a client component.
- **`group-priority/DungeonRow.tsx`**: renders `DungeonDisclosure`, passes the member chips as `summaryExtra` and its existing body (split note, then each member's credits) as `children`. The output is the same markup as today.
- **`character-page/DungeonPriority.tsx`**: each `li` renders `DungeonDisclosure` with no `summaryExtra`. The body is the split note, then the `Credit` list, in a `flex flex-col gap-2.5 px-2.5 pb-3` wrapper like the group row's body. The `ol` gap changes from `gap-4` to the group's `gap-1.5`, and each `li` gets `min-w-0`. The rank is the dungeon's position in `priority.dungeons`, starting at 1.

### Skeleton

`character-page/DungeonRowsSkeleton.tsx` draws the new shape: one open row, a 52 px header with two `ItemCard`-sized blocks under it, then three 52 px collapsed rows, with `gap-1.5`. `DungeonPrioritySkeleton` keeps using it unchanged.

## Testing

- **Loader:** a `getCharacterPage` test in `src/server/views/views.test.ts` checks that each priority dungeon carries `shortName` and `imageUrl` from season data, and `''` and `null` when the season has no art for it.
- **Markup:** a `renderToStaticMarkup` test of the character page's `DungeonPriority`, like `GroupPriority.test.ts`, checks that the first dungeon's `details` is open and the rest are closed, that the summary has the rank, name in an `h3` and score, and that the split note sits inside the body.
- **Group page:** existing group priority tests pass unchanged.
- **Thumbnail:** `thumbnail-label.test.ts` passes from its new directory.
- **By hand at 375 and 1440 px:** toggle rows with the keyboard, check the fallback tile with an image blocked, and compare the skeleton with the loaded section for no large jump.
