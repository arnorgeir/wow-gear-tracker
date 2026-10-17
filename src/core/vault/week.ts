import type { Region } from '../types';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Weekly reset as a UTC weekday (0 = Sunday) and hour. KR and TW are unverified guesses (spec). */
export const RESETS: Record<Region, { day: number; hour: number }> = {
  us: { day: 2, hour: 15 },
  eu: { day: 3, hour: 4 },
  kr: { day: 3, hour: 23 },
  tw: { day: 3, hour: 23 },
};

const ZONES: Record<Region, string> = { us: 'America/New_York', eu: 'Europe/Paris', kr: 'Asia/Seoul', tw: 'Asia/Taipei' };

/** Epoch ms of the latest reset at or before `at`. */
export function weekStart(region: Region, at: number): number {
  const { day, hour } = RESETS[region];
  const d = new Date(at);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let start = midnight + hour * HOUR - ((d.getUTCDay() - day + 7) % 7) * DAY;
  if (start > at) start -= 7 * DAY;
  return start;
}

/** "Week of Wed 14 Oct": the reset date in the region's own time zone. */
export function formatWeek(region: Region, start: number): string {
  const text = new Intl.DateTimeFormat('en-GB', { timeZone: ZONES[region], weekday: 'short', day: 'numeric', month: 'short' }).format(start);
  return `Week of ${text.replace(',', '')}`;
}
