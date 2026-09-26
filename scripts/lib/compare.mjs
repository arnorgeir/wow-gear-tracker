// Compares equipped items against one BiS list.
// Tier rows count as met by any tier piece in that slot, since Method lists the catalyst source item.
// Rings and trinkets are matched regardless of which of the two slots they sit in.

export function compare(equipped, bisList) {
  const bySlot = Object.fromEntries(equipped.map(i => [i.slot, i]));
  const usedSlots = new Set();

  const matches = (bis, item) => item && (bis.isTier ? item.isTier : item.itemId === bis.itemId);

  // First pass: exact matches, so a paired slot isn't claimed by the wrong row.
  const rows = bisList.map(bis => {
    const slot = bis.slots.find(s => !usedSlots.has(s) && matches(bis, bySlot[s]));
    if (slot) usedSlots.add(slot);
    return { bis, slot, done: Boolean(slot) };
  });
  // Second pass: show what currently sits in the slot for rows still missing.
  for (const row of rows.filter(r => !r.done)) {
    row.slot = row.bis.slots.find(s => !usedSlots.has(s)) ?? row.bis.slots[0];
    usedSlots.add(row.slot);
  }
  return rows.map(({ bis, slot, done }) => ({ bis, equipped: bySlot[slot], slot, done }));
}
