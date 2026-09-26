const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatAge(fromMs: number, nowMs: number): string {
  const age = Math.max(0, nowMs - fromMs);
  if (age < MIN) return 'just now';
  if (age < HOUR) return `${Math.floor(age / MIN)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  const days = Math.floor(age / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
