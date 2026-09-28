import type { Faction } from '@/core/types';

const BADGE: Record<Faction, { label: string; bg: string; fg: string }> = {
  HORDE: { label: 'Horde', bg: '#7a1414', fg: '#f0b2a0' },
  ALLIANCE: { label: 'Alliance', bg: '#153a7a', fg: '#e7c46a' },
};

/** Faction name and a text color with enough contrast on the dark surfaces. */
export const FACTION_TEXT: Record<Faction, { label: string; color: string }> = {
  HORDE: { label: 'Horde', color: '#e8836b' },
  ALLIANCE: { label: 'Alliance', color: '#7fa8f0' },
};

/** A small shield in faction colors. Decorative: always pair it with the faction name in text. */
export function FactionBadge({ faction, size = 20 }: { faction: Faction; size?: number }) {
  const badge = BADGE[faction];
  return (
    <span title={badge.label} aria-hidden="true"
      className="flex items-center justify-center rounded-full border-2 border-surface-2" style={{ width: size, height: size, background: badge.bg }}>
      <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill={badge.fg}>
        <path d="M12 2l8 3.5v6.5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.5z" />
      </svg>
    </span>
  );
}
