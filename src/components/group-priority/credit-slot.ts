const SHORT: Record<string, string> = {
  Shoulder: 'Shldr', Shoulders: 'Shldr', Trinket: 'Trink', Weapon: 'Weap', 'Main Hand': 'Weap', 'Main-Hand': 'Weap', 'Off Hand': 'Off-h', 'Off-Hand': 'Off-h',
};

/** Method's slot label, short enough to sit under a 32 px chip. Unknown labels pass through. */
export const creditSlot = (label: string) => SHORT[label] ?? label;
