export const LEGACY_HINT = 'Not on a current season upgrade track, so it is from an earlier season';

// Literal class names, so Tailwind sees them. The colors come from the Mistcrest icons, brightened for the dark theme.
const TRACK_CLASS: Record<string, string> = {
  Adventurer: 'text-track-adventurer',
  Veteran: 'text-track-veteran',
  Champion: 'text-track-champion',
  Hero: 'text-track-hero',
  Myth: 'text-track-myth',
};
const LEGACY_CLASS = 'text-legacy italic';

/** What a track shows as: its own label in its color, or Legacy for an item on no current-season track. */
export function trackDisplay(label: string | null): { text: string; className: string; hint: string | undefined } {
  if (label === null) return { text: 'Legacy', className: LEGACY_CLASS, hint: LEGACY_HINT };
  return { text: label, className: TRACK_CLASS[label.split(' ')[0]!] ?? 'text-muted', hint: undefined };
}

/** Splits a card detail such as "Myth 1/6 · 318" into its leading track and the rest, so only the track is colored. */
export function detailParts(detail: string): { lead: string; className: string; rest: string } {
  const lead = /^(Adventurer|Veteran|Champion|Hero|Myth)( \d+\/\d+)?|^Legacy/.exec(detail)?.[0] ?? '';
  if (!lead) return { lead: '', className: '', rest: detail };
  return { lead, className: lead === 'Legacy' ? LEGACY_CLASS : TRACK_CLASS[lead.split(' ')[0]!]!, rest: detail.slice(lead.length) };
}
