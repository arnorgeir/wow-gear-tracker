import type { BisRow } from '../types';

/** Names each row `<slotLabel>#<n>`, counting rows with the same label in list order. Overrides key on it. */
export function slotKeys(rows: BisRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = (seen.get(r.slotLabel) ?? 0) + 1;
    seen.set(r.slotLabel, n);
    return `${r.slotLabel}#${n}`;
  });
}
