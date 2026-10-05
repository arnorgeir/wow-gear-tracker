# Forged Wayfinder — asset pack v1

Open Crest emblem and the approved heavier, angular utility icon family.
The Group icon retains octagonal heads and angular shoulders. No final site
name, initials, or wordmark is baked into the assets.

## Files

- `logos/`: editable flat SVG masters in gold, parchment, charcoal and
  `currentColor`; transparent PNGs at 256, 512 and 1024 px; a small-size SVG;
  and a separate transparent metallic illustration for larger artwork.
- `icons/`: Characters, Group, Dungeons, Vault, Upgrades and Bags. Gold SVGs
  use a 64-unit grid and a 3.2-unit stroke. `current-color/` contains inline
  SVG variants that inherit CSS color. `png/` has 24, 32, 64 and 128 px exports.
- `favicon/`: dark-backed SVG and 16, 32, 48 and 64 px PNGs. `favicon.ico`
  contains the 16, 32 and 48 px PNG frames.
- `app-icons/`: opaque square 180, 192, 512 and 1024 px app icons; 180 px
  Apple touch icon; separate 192 and 512 px maskable icons with extra padding.
  The operating system supplies rounded corners or other masks.
- `motifs/`: transparent corner frame and divider SVGs.
- `social/`: a name-independent 1200 × 630 sharing background, SVG and PNG.
- `preview.png` and `preview.svg`: a portrait overview of the actual vector
  assets. The size samples are at their stated sizes in the 900 px-wide
  original, but chat and browser previews may scale the entire sheet.
- `validation.txt`: asset validation results.

## Source and fidelity

The flat vectors are manually reconstructed from the approved raster concept,
with the same open crest, central ascending form and winding path. They are
editable artwork, not a pixel-exact tracing of the concept's rendered bevels.
The small-size variant removes the tiny exterior notches and simplifies the
path connection for rasterization. It preserves the overall emblem.

The metallic PNG is a separate rendered interpretation isolated from the
approved Open Crest reference. Use it as decorative large artwork, not as the
geometric source of truth or a favicon. Flat SVGs are the implementation
masters. Inspect the vector preview before changing the artwork.

## Usage

Use the flat gold logo on dark backgrounds and charcoal on light backgrounds.
Keep clear space of at least 12% of the logo width. Prefer the small-size mark
below 32 px; the central winding path naturally becomes less distinct at 16 px.
Utility icons are intended for 24–32 px UI use. Keep their labels in navigation
and avoid compressing detailed icons below 24 px.

For inline SVG, use the `current-color` icons and set CSS `color` from the
application's semantic tokens. CSS color does not cross into an external
`<img>` SVG; use the gold files for that case. When a visible label already
provides the accessible name, make the icon decorative (`aria-hidden="true"`
for inline SVG, or `alt=""` for an image). Standalone controls need a label.

Palette: background `#14120f`, surface `#1d1a16`, bronze line `#3a342b`,
parchment `#ece6da`, gold `#f2c14e`. Retain the app's Cinzel / Barlow / IBM Plex
Mono typography. No fonts are bundled. Supporting ornament should be subtle
and should not compete with gear rarity and state colors.

## Installed in the app

The pack moved here from `output/brand/` when it was installed (issue #77).
These files and components hold copies of its artwork. Update them with the
masters here when the artwork changes.

| In the app | Copied from |
|---|---|
| `src/app/favicon.ico` | `favicon/favicon.ico` |
| `src/app/icon.svg` | `favicon/favicon.svg` |
| `src/app/apple-icon.png` | `app-icons/apple-touch-icon.png` |
| `public/brand/open-crest-metallic.png` (setup notice) | `logos/open-crest-metallic.png` |
| `src/components/brand-mark/BrandMark.tsx` (inline paths) | `logos/open-crest-mono.svg` |
| `src/components/brand-icon/BrandIcon.tsx` (inline paths: characters, group, dungeons, vault) | `icons/current-color/` |
| `src/components/setup-notice/CornerFrame.tsx` (one corner, mirrored) | `motifs/corner-frame.svg` |
| Header bottom line with a gold diamond, `src/app/layout.tsx` (drawn in CSS) | `motifs/divider.svg` |

Not installed yet: the regular and maskable app icons (they belong to a web
app manifest, which waits for the site's name), the Upgrades and Bags icons,
the gold, parchment and charcoal logo files, and the social background.

The design decisions are in
`docs/superpowers/specs/2026-10-04-forged-wayfinder-identity-design.md`.
