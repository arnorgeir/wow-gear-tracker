# Spike: BiS sources besides Method

Issue: #124. Feeds #125 (choose a BiS source per spec, including fully manual lists).
Checked: 2026-10-11, patch 12.1 (Midnight Season 2). Pages fetched with a plain `curl` and a browser user agent, the way `src/core/method` fetches Method.gg.

## Summary

| | Icy Veins | murlok.io | Wowhead |
|---|---|---|---|
| Spec coverage | All 40 specs | All specs, Mythic+ and PvP only | All specs (guides exist) |
| Overall / Raid / Mythic+ | All three, every spec sampled | Mythic+ only, no Raid or Overall | Not readable (see below) |
| What the list is | Curated by a guide writer | Most-worn items among the top 50 Mythic+ players of the spec | Curated |
| Server-side fetch | 200, full content in HTML | 200, full content in HTML | 403 from CloudFront to `curl`; content renders client-side |
| API or structured data | None; clean semantic classes | None public; data comes from Blizzard's API | None; tries to block parsing |
| robots.txt | Guides allowed (only forum and module paths disallowed) | `Allow: /` | Blocks the fetch itself |
| Terms of use | No clause on scraping or automated access ([terms](https://www.icy-veins.com/terms)) | No terms page; robots allows all | Could not read; operator does not offer an API |

**Recommendation for #125: support Icy Veins next to Method, plus fully manual lists. Leave murlok.io and Wowhead out.**

## Icy Veins

- **URL:** `https://www.icy-veins.com/wow/<spec>-<class>-pve-<role>-gear-best-in-slot`, role `dps`, `tank` or `healing`. The sitemap lists exactly 40 such pages, one per spec, including Devourer Demon Hunter. The role segment means the URL can't be built from the spec slug alone: store it per spec, or read it from the sitemap.
- **Lists:** every page sampled (Frost Mage, Guardian Druid, Restoration Shaman, Devourer Demon Hunter, Augmentation Evoker) has the same three `<h3>` sections: "Overall Best in Slot", "Best Gear from Mythic+", "Best Gear from Raid". They map one to one onto our `overall`, `mythicPlus` and `raid`.
- **Markup:** each section is a `div.bis_items_grid` of `div.bis_item` cards. A card holds:
  - `data-wowhead="item=<id>&bonus=<ids>"`: the item ID, plus bonus IDs.
  - `span.bis_item_slot`: the slot name, in the site's own words ("Helm", "Hands", "Neck"). It needs a name map, as Method's does.
  - `original-item=<id>` in the same attribute, with "Catalyst from <boss>" in `span.bis_item_drop`, when the pick is a catalyst conversion. This matches our catalyst override model: the original item is the base, the listed item is the tier piece.
  - Gems and enchants in `bis_item_extras` and `bis_item_enchant`. We can ignore them.
- **Size:** about 300 KB per page, 54 cards across three lists (18 per list, so two rings and two trinkets each).
- **Stability:** the class names are purpose-named (`bis_item`, `bis_item_slot`), not generated. That reads as more stable than Method's tables. It is still HTML parsing, with no API: a redesign breaks it, as with Method.
- **Terms:** the terms page has no scraping or automated-access clause. The guides are copyrighted text. We would store only item IDs per slot, which are facts, and link back to the page, as we do for Method.
- **Risks:** trinkets also have a separate tier table (the page's only `<table>`). The lists already name two trinkets each, so the table can be ignored. A row naming no single item, like Method's "Any 334", was not seen in the sample, but the parser should tolerate one.

## murlok.io

- **What it is:** a daily crawl of Blizzard's leaderboards and the Armory. Per slot, it ranks the items worn by the top 50 players of a spec across US, EU, KR and TW, with a count of players per item.
- **URL:** `https://murlok.io/<class>/<spec>/m+`. Other modes are PvP (`2v2`, `3v3`, `rbg`, `solo`, `blitz`). Hero-talent variants exist (`/mage/frost/frostfire/m+`). `/raid` returns 404: there is no Raid or Overall list.
- **Markup:** server-rendered by go-app. Slots are `<h4>` headings, and items are `li.vi-poppable` with `href="https://www.wowhead.com/item=<id>"` and a player count. Class names are generic UI-kit names (`vi-box`, `vi-infobar`). They are stable only as long as the kit is.
- **Terms:** no terms page. robots.txt allows all paths. The app has an internal API for its own UI, which is not published.
- **Why not now:** it covers only one of our three lists, and "most worn" is a different kind of list from BiS. Its data is Blizzard's public API, which we already call. If a popularity view is wanted, we could build it from Raider.IO's top players and Blizzard profiles without depending on murlok. That is a separate idea, not #125.

## Wowhead

- `curl` to guide pages and to `robots.txt` gets a CloudFront 403 ("Request blocked"). A fetch that gets past it receives the page shell (title, "Updated 2026/08/18", author) but not the gear lists, which render client-side from embedded markup.
- No public API. A Blizzard forum post describes Wowhead as actively preventing parsing. We could not read Wowhead's terms page.
- **Why not:** reading it would mean working around bot protection, which we won't do. Our Wowhead use stays at tooltips and the undocumented currency endpoint we already use.

## What #125 should design for

- **Sources:** Method, Icy Veins and Manual, chosen per spec and per account. That gives the picker three real options, so it is no longer noise.
- **The `BisSource` interface fits:** Icy Veins becomes a second implementation beside Method, with its own parser, fixtures and live test.
- **Per-spec page URLs:** Icy Veins can't derive the URL from our slug. Keep a slug-to-URL table, or resolve it from the sitemap.
- **Catalyst picks come with their base item** (`original-item`). The design can store them as catalyst entries directly.
- **Overrides when the source changes:** overrides are keyed by slot. Decide whether they carry across sources, or are kept per source.
- **Fixtures:** trimmed Icy Veins pages, as the repo rules require for third-party pages.
