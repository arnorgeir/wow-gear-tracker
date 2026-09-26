// Smoke test: get a client-credentials token and print a character's equipped gear.
// Run: node --env-file=.env scripts/smoke-test.mjs
const { BLIZZARD_CLIENT_ID: id, BLIZZARD_CLIENT_SECRET: secret, BLIZZARD_REGION: region = 'eu', WOW_REALM: realm, WOW_CHARACTER: character } = process.env;

for (const [key, value] of Object.entries({ BLIZZARD_CLIENT_ID: id, BLIZZARD_CLIENT_SECRET: secret, WOW_REALM: realm, WOW_CHARACTER: character })) {
  if (!value) { console.error(`Missing ${key} in .env`); process.exit(1); }
}

const tokenRes = await fetch('https://oauth.battle.net/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
if (!tokenRes.ok) { console.error('Token request failed:', tokenRes.status, await tokenRes.text()); process.exit(1); }
const { access_token, expires_in } = await tokenRes.json();
console.log(`Token OK (expires in ${Math.round(expires_in / 3600)}h)\n`);

const name = encodeURIComponent(character.toLowerCase());
const url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/equipment?namespace=profile-${region}&locale=en_GB`;
const gearRes = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
if (!gearRes.ok) { console.error('Equipment request failed:', gearRes.status, await gearRes.text()); process.exit(1); }
const gear = await gearRes.json();

console.log(`${gear.character.name} @ ${gear.character.realm.name}\n`);
console.table(gear.equipped_items.map(i => ({
  slot: i.slot.type,
  itemId: i.item.id,
  name: i.name,
  ilvl: i.level?.value,
  bonusIds: (i.bonus_list ?? []).join(':'),
})));
