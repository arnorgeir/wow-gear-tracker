const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', Druid: '#FF7C0A', Evoker: '#33937F', Hunter: '#AAD372',
  Mage: '#3FC7EB', Monk: '#00FF98', Paladin: '#F48CBA', Priest: '#E8E8E8', Rogue: '#FFF468',
  Shaman: '#2F8FEF', Warlock: '#8788EE', Warrior: '#C69B6D',
};

export const classColor = (className: string) => CLASS_COLORS[className] ?? '#a79e8e';
