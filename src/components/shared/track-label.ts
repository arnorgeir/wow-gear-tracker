export const NO_TRACK_HINT = 'Not on a current season upgrade track. Often an item from an earlier season.';

// Literal class names, so Tailwind sees them. The colors come from the Mistcrest icons, brightened for the dark theme.
const TRACK_CLASS: Record<string, string> = {
  Adventurer: 'text-track-adventurer',
  Veteran: 'text-track-veteran',
  Champion: 'text-track-champion',
  Hero: 'text-track-hero',
  Myth: 'text-track-myth',
};
const NO_TRACK_CLASS = 'text-legacy italic';

/** A track's label, or No track for an item that matches none. A missing track says nothing certain about the item's season. */
export const trackText = (label: string | null) => label ?? 'No track';

/**
 * What a track shows as. An item matching no track says No track, never a season: the data does not
 * establish one. While the track data is loaded it is highlighted, with a hedged hint, since it is
 * often an earlier season's item; without the data every item matches nothing, so it stays neutral.
 */
export function trackDisplay(label: string | null, tracksKnown: boolean): { text: string; className: string; hint: string | undefined } {
  if (label === null) {
    return tracksKnown
      ? { text: 'No track', className: NO_TRACK_CLASS, hint: NO_TRACK_HINT }
      : { text: 'No track', className: 'text-muted', hint: undefined };
  }
  return { text: label, className: TRACK_CLASS[label.split(' ')[0]!] ?? 'text-muted', hint: undefined };
}

/** Splits a card detail such as "Myth 1/6 · 318" into its leading track and the rest, so only the track is colored. */
export function detailParts(detail: string): { lead: string; className: string; rest: string } {
  const lead = /^(Adventurer|Veteran|Champion|Hero|Myth)( \d+\/\d+)?/.exec(detail)?.[0] ?? '';
  if (!lead) return { lead: '', className: '', rest: detail };
  return { lead, className: TRACK_CLASS[lead.split(' ')[0]!]!, rest: detail.slice(lead.length) };
}
