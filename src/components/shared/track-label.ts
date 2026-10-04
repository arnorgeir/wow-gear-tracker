export const LEGACY_HINT = 'Not on a current season upgrade track, so it is likely from an earlier season';

// Literal class names, so Tailwind sees them. The colors come from the Mistcrest icons, brightened for the dark theme.
const TRACK_CLASS: Record<string, string> = {
  Adventurer: 'text-track-adventurer',
  Veteran: 'text-track-veteran',
  Champion: 'text-track-champion',
  Hero: 'text-track-hero',
  Myth: 'text-track-myth',
};
const LEGACY_CLASS = 'text-legacy italic';

/** A track's label, or what to call an item that matches no track: Legacy when the tracks are known, else just No track. */
export const trackText = (label: string | null, tracksKnown: boolean) => label ?? (tracksKnown ? 'Legacy' : 'No track');

/**
 * What a track shows as. An item matching no track is only called Legacy while the track data is loaded:
 * without it every item matches nothing, and that says nothing about the season.
 */
export function trackDisplay(label: string | null, tracksKnown: boolean): { text: string; className: string; hint: string | undefined } {
  if (label === null) {
    return tracksKnown
      ? { text: 'Legacy', className: LEGACY_CLASS, hint: LEGACY_HINT }
      : { text: 'No track', className: 'text-muted', hint: undefined };
  }
  return { text: label, className: TRACK_CLASS[label.split(' ')[0]!] ?? 'text-muted', hint: undefined };
}

/** Splits a card detail such as "Myth 1/6 · 318" into its leading track and the rest, so only the track is colored. */
export function detailParts(detail: string): { lead: string; className: string; rest: string } {
  const lead = /^(Adventurer|Veteran|Champion|Hero|Myth)( \d+\/\d+)?|^Legacy/.exec(detail)?.[0] ?? '';
  if (!lead) return { lead: '', className: '', rest: detail };
  return { lead, className: lead === 'Legacy' ? LEGACY_CLASS : TRACK_CLASS[lead.split(' ')[0]!]!, rest: detail.slice(lead.length) };
}
