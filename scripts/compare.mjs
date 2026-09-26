// Compares your equipped gear to Method.gg's BiS lists.
// Run: node --env-file=.env scripts/compare.mjs [spec-slug] [--refresh]
// Without a spec slug, it uses the character's active spec.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { getToken, getEquipment, getSpecSlug } from './lib/blizzard.mjs';
import { fetchGearingHtml, parseGearing } from './lib/method.mjs';
import { compare } from './lib/compare.mjs';

const CACHE_DIR = '.cache/method';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LISTS = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

const env = process.env;
const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const ctx = { region: env.BLIZZARD_REGION ?? 'eu', realm: env.WOW_REALM, character: env.WOW_CHARACTER };

async function loadBis(specSlug) {
  const file = `${CACHE_DIR}/${specSlug}.json`;
  const fresh = await stat(file).then(s => Date.now() - s.mtimeMs < CACHE_TTL_MS, () => false);
  if (fresh && !refresh) return JSON.parse(await readFile(file, 'utf8'));
  const bis = parseGearing(await fetchGearingHtml(specSlug));
  if (!bis.overall.length) throw new Error(`No BiS tables found for "${specSlug}". Check the slug on method.gg.`);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(bis, null, 2));
  return bis;
}

const token = await getToken({ clientId: env.BLIZZARD_CLIENT_ID, clientSecret: env.BLIZZARD_CLIENT_SECRET });
const specSlug = args.find(a => !a.startsWith('--')) ?? await getSpecSlug({ token, ...ctx });
const [{ character, realm, items }, bis] = await Promise.all([getEquipment({ token, ...ctx }), loadBis(specSlug)]);

console.log(`${character} @ ${realm}, compared to Method's ${specSlug} BiS\n`);
for (const [key, label] of Object.entries(LISTS)) {
  const rows = compare(items, bis[key]);
  const done = rows.filter(r => r.done).length;
  console.log(`${label}: ${done}/${rows.length} BiS`);
  console.table(rows.map(r => ({
    slot: r.bis.slot,
    status: r.done ? (r.bis.isTier ? 'OK (tier)' : 'OK') : 'missing',
    equipped: r.equipped ? `${r.equipped.name} (${r.equipped.ilvl})` : '-',
    bis: r.bis.isTier ? `Tier piece (catalyst ${r.bis.name})` : r.bis.name,
    source: r.bis.source,
  })));
}
