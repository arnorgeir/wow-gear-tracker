// Battle.net API client (client credentials flow). Server-side only: needs the client secret.

export async function getToken({ clientId, clientSecret }) {
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Returns the equipped items as { slot, itemId, name, ilvl, bonusIds, isTier }. */
export async function getEquipment({ token, region, realm, character }) {
  const name = encodeURIComponent(character.toLowerCase());
  const url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}/equipment?namespace=profile-${region}&locale=en_GB`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Equipment request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    character: data.character.name,
    realm: data.character.realm.name,
    items: data.equipped_items.map(i => ({
      slot: i.slot.type,
      itemId: i.item.id,
      name: i.name,
      ilvl: i.level?.value,
      bonusIds: i.bonus_list ?? [],
      // Tier pieces carry an item set; Method marks those rows "(Tier Set)".
      isTier: Boolean(i.set),
      setName: i.set?.item_set?.name,
    })),
  };
}

/** Returns the Method-style spec slug for the character's active spec, e.g. "guardian-druid". */
export async function getSpecSlug({ token, region, realm, character }) {
  const name = encodeURIComponent(character.toLowerCase());
  const url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}?namespace=profile-${region}&locale=en_GB`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Profile request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const slug = s => s.toLowerCase().replace(/\s+/g, '-');
  return `${slug(data.active_spec.name)}-${slug(data.character_class.name)}`;
}
