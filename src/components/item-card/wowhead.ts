/** The `data-wowhead` attribute, with bonus IDs and item level so the tooltip shows this exact item. */
export function wowheadData(itemId: number, bonusIds: number[], itemLevel: number | null): string {
  const parts = [`item=${itemId}`];
  if (bonusIds.length > 0) parts.push(`bonus=${bonusIds.join(':')}`);
  if (itemLevel) parts.push(`ilvl=${itemLevel}`);
  return parts.join('&');
}
