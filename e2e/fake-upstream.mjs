// Preloaded into `next start` with --import. Answers every external request the server makes,
// so a browser run needs no credentials and never touches Blizzard, Raider.IO, Method or Raidbots.
// A request no route matches gets a 404 and is logged, and the shared fixture fails the test.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';

const realFetch = globalThis.fetch;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const UNMATCHED_LOG = '.cache/e2e/unmatched.log';

// Trimmed pages and payloads the repo already keeps for its unit tests are reused, not copied.
const METHOD_PAGE = readFileSync('src/core/method/__fixtures__/gearing.html', 'utf8');
const CURRENCY_TOOLTIP = readFileSync('src/core/wowhead/__fixtures__/currency-3446.json', 'utf8');

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// [string | RegExp, handler]. First match wins.
const routes = [
  ['oauth.battle.net/token', () => json({ access_token: 'fake', expires_in: 86400 })],
  [/eu\.api\.blizzard\.com\/data\/wow\/realm\/index/, () => json({ realms: [
    { id: 1305, name: 'Kazzak', slug: 'kazzak' },
    { id: 1096, name: 'Argent Dawn', slug: 'argent-dawn' },
  ] })],
  // A term containing "outage" makes Raider.IO fail, which sends the bar to the manual realm picker.
  ['raider.io/api/search', (url) => url.includes('outage') ? json({}, 500) : json({ matches: [
    { type: 'character', data: { name: 'Birkibjörn', region: { slug: 'eu' }, realm: { name: 'Kazzak', wowRealmId: 1305 }, class: { name: 'Druid' }, faction: 'horde' } },
  ] })],
  // Any made-up character whose name starts with "birki" exists, a Guardian Druid on the realm in the URL.
  [/\/profile\/wow\/character\/([^/]+)\/(birki[^/?]*)\/equipment/, () => json({ equipped_items: [
    { slot: { type: 'HEAD' }, item: { id: 271875 }, name: 'Gaze of the Coiled Watcher', level: { value: 250 }, quality: { type: 'EPIC' }, bonus_list: [] },
    { slot: { type: 'NECK' }, item: { id: 268265 }, name: 'Aqirbane Reliquary', level: { value: 240 }, quality: { type: 'RARE' }, bonus_list: [] },
  ] })],
  [/\/profile\/wow\/character\/([^/]+)\/(birki[^/?]*)\/character-media/, () => json({ assets: [] })],
  [/\/profile\/wow\/character\/([^/]+)\/(birki[^/?]*)(\?|$)/, (url) => {
    const [, slug, name] = url.match(/\/character\/([^/]+)\/([^/?]+)/);
    const decoded = decodeURIComponent(name);
    return json({
      name: decoded[0].toUpperCase() + decoded.slice(1),
      realm: { id: slug === 'kazzak' ? 1305 : 1096, name: slug === 'kazzak' ? 'Kazzak' : 'Argent Dawn', slug },
      character_class: { name: 'Druid' }, active_spec: { name: 'Guardian' }, race: { name: 'Troll' }, faction: { type: 'HORDE' },
    });
  }],
  [/eu\.api\.blizzard\.com\/data\/wow\/playable-class\/index/, () => json({ classes: [{ id: 11, name: 'Druid' }] })],
  [/eu\.api\.blizzard\.com\/data\/wow\/playable-class\/11/, () => json({ specializations: [{ id: 104, name: 'Guardian' }] })],
  [/\/data\/wow\/media\/(playable-class|playable-specialization|item)\//, () => json({ assets: [{ key: 'icon', value: 'https://render.worldofwarcraft.com/icon.jpg' }] })],
  [/\/data\/wow\/item\/\d+/, () => json({ name: 'Trimmed Item', quality: { type: 'EPIC' }, inventory_type: { type: 'HEAD' }, item_class: { id: 4 }, item_subclass: { id: 2 }, preview_item: {} })],
  ['raidbots.com/static/data/live/bonuses.json', () => json({
    '12850': { upgrade: { group: 618, level: 2, max: 6, name: 'Myth', fullName: 'Myth 2/6', bonusId: 12850, costs: [{ amounts: [{ currencyId: 3446, amount: 20, name: 'Myth Mistcrest' }] }] } },
    '12805': { id: 12805, quality: 4 },
  })],
  ['nether.wowhead.com/tooltip/currency/', () => new Response(CURRENCY_TOOLTIP, { headers: { 'content-type': 'application/json' } })],
  ['method.gg/guides/', () => new Response(METHOD_PAGE, { headers: { 'content-type': 'text/html' } })],
  // No started season: the dungeon ranking stays empty and the app logs a tolerated season failure.
  ['raider.io/api/v1/mythic-plus/static-data', () => json({ seasons: [] })],
  // Blizzard's answer for a character that does not exist.
  [/\/profile\/wow\/character\/[^/]+\/(zzzqqxnotreal|nobody[^/?]*)(\/|\?)/, () => json({ code: 404, type: 'BLZWEBAPI00000404', detail: 'Not Found' }, 404)],
];

globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (LOOPBACK.has(new URL(url).hostname)) return realFetch(input, init);
  const route = routes.find(([match]) => (typeof match === 'string' ? url.includes(match) : match.test(url)));
  if (route) return route[1](url, init);
  mkdirSync('.cache/e2e', { recursive: true });
  appendFileSync(UNMATCHED_LOG, `${url}\n`);
  return json({ error: `fake-upstream: no route for ${url}` }, 404);
};
