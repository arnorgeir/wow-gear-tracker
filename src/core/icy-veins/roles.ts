// Icy Veins puts the role in the URL. Roles never change; a new tank or healer spec needs one line here.
// The live test catches a wrong entry: its URL 404s.
const ROLES: Record<string, 'tank' | 'healing'> = {
  'blood-death-knight': 'tank', 'vengeance-demon-hunter': 'tank', 'guardian-druid': 'tank',
  'brewmaster-monk': 'tank', 'protection-paladin': 'tank', 'protection-warrior': 'tank',
  'restoration-druid': 'healing', 'preservation-evoker': 'healing', 'mistweaver-monk': 'healing', 'holy-paladin': 'healing',
  'discipline-priest': 'healing', 'holy-priest': 'healing', 'restoration-shaman': 'healing',
};

export const icyVeinsUrl = (specSlug: string) =>
  `https://www.icy-veins.com/wow/${specSlug}-pve-${Object.hasOwn(ROLES, specSlug) ? ROLES[specSlug] : 'dps'}-gear-best-in-slot`;
