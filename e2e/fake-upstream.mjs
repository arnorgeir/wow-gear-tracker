// Preloaded into `next start` with --import. Answers every external request the server makes,
// so a browser run needs no credentials and never touches Blizzard, Raider.IO, Method or Raidbots.
// A request no route matches gets a 404 and is logged, and the shared fixture fails the test.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';

const realFetch = globalThis.fetch;

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const METHOD_WITHOUT_CLOAK_FLAG = '.cache/e2e/method-without-cloak';
const UNMATCHED_LOG = '.cache/e2e/unmatched.log';
const CLOCK_SKEW_FILE = '.cache/e2e/clock-skew-ms';

// Lets a test age the server's caches: Date.now runs ahead by the milliseconds in this file, if any.
// The file is looked at most every 50 ms, so the clock costs a comparison per call.
const realNow = Date.now.bind(Date);
let skew = 0;
let skewCheckedAt = 0;
Date.now = () => {
  const t = realNow();
  if (t - skewCheckedAt > 50) {
    skewCheckedAt = t;
    try { skew = Number(readFileSync(CLOCK_SKEW_FILE, 'utf8')) || 0; } catch { skew = 0; }
  }
  return t + skew;
};

// Trimmed pages and payloads the repo already keeps for its unit tests are reused, not copied.
const METHOD_PAGE = readFileSync('src/core/method/__fixtures__/gearing.html', 'utf8');
const CURRENCY_TOOLTIP = readFileSync('src/core/wowhead/__fixtures__/currency-3446.json', 'utf8');

// Per character name: how many profile requests the fake has answered.
const profileCalls = new Map();

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
  // Any made-up character whose name starts with "birki" exists, a Guardian Druid ("birkiferal": Feral) on the realm in the URL.
  [/\/profile\/wow\/character\/([^/]+)\/(birki[^/?]*)\/equipment/, () => json({ equipped_items: [
    { slot: { type: 'HEAD' }, item: { id: 271875 }, name: 'Gaze of the Coiled Watcher', level: { value: 250 }, quality: { type: 'EPIC' }, bonus_list: [] },
    { slot: { type: 'NECK' }, item: { id: 268265 }, name: 'Aqirbane Reliquary', level: { value: 240 }, quality: { type: 'RARE' }, bonus_list: [] },
  ] })],
  [/\/profile\/wow\/character\/([^/]+)\/(birki[^/?]*)\/character-media/, () => json({ assets: [] })],
  [/\/profile\/wow\/character\/([^/]+)\/(birki[^/?]*)(\?|$)/, (url) => {
    const [, slug, name] = url.match(/\/character\/([^/]+)\/([^/?]+)/);
    const decoded = decodeURIComponent(name);
    // "birkiflaky" answers the two profile requests that adding makes, and fails every later one, so a re-sync records an error.
    if (decoded.startsWith('birkiflaky')) {
      profileCalls.set(decoded, (profileCalls.get(decoded) ?? 0) + 1);
      if (profileCalls.get(decoded) > 2) return json({}, 500);
    }
    return json({
      name: decoded[0].toUpperCase() + decoded.slice(1),
      realm: { id: slug === 'kazzak' ? 1305 : 1096, name: slug === 'kazzak' ? 'Kazzak' : 'Argent Dawn', slug },
      character_class: { name: 'Druid' }, active_spec: { name: decoded.startsWith('birkiferal') ? 'Feral' : 'Guardian' }, race: { name: 'Troll' }, faction: { type: 'HORDE' },
    });
  }],
  [/eu\.api\.blizzard\.com\/data\/wow\/playable-class\/index/, () => json({ classes: [{ id: 11, name: 'Druid' }] })],
  [/eu\.api\.blizzard\.com\/data\/wow\/playable-class\/11/, () => json({ specializations: [{ id: 104, name: 'Guardian' }] })],
  [/\/data\/wow\/media\/(playable-class|playable-specialization|item)\//, () => json({ assets: [{ key: 'icon', value: 'https://render.worldofwarcraft.com/icon.jpg' }] })],
  // Items 900100-900199 are cloaks, anything else a leather head piece. None is a tier piece.
  [/\/data\/wow\/item\/(\d+)/, (url) => {
    const cloak = /^9001\d\d$/.test(url.match(/\/item\/(\d+)/)[1]);
    return json({ name: cloak ? 'Trimmed Cloak' : 'Trimmed Helm', quality: { type: 'EPIC' }, inventory_type: { type: cloak ? 'CLOAK' : 'HEAD' }, item_class: { id: 4 }, item_subclass: { id: cloak ? 0 : 2 }, preview_item: {} });
  }],
  ['raidbots.com/static/data/live/bonuses.json', () => json({
    '12850': { upgrade: { group: 618, level: 2, max: 6, name: 'Myth', fullName: 'Myth 2/6', bonusId: 12850, costs: [{ amounts: [{ currencyId: 3446, amount: 20, name: 'Myth Mistcrest' }] }] } },
    '12805': { id: 12805, quality: 4 },
  })],
  ['nether.wowhead.com/tooltip/currency/', () => new Response(CURRENCY_TOOLTIP, { headers: { 'content-type': 'application/json' } })],
  // A test that needs a row to vanish from a spec's list writes that spec's slug to the flag file; its Cloak row is then dropped.
  ['method.gg/guides/', (url) => {
    const dropCloak = existsSync(METHOD_WITHOUT_CLOAK_FLAG) && url.includes(`/guides/${readFileSync(METHOD_WITHOUT_CLOAK_FLAG, 'utf8')}/`);
    const page = dropCloak ? METHOD_PAGE.replace(/<tr><td>Cloak<\/td>.*<\/tr>\n/, '') : METHOD_PAGE;
    return new Response(page, { headers: { 'content-type': 'text/html' } });
  }],
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
