// Preloaded into `next start` with --import. Answers every external request the server makes,
// so a browser run needs no credentials and never touches Blizzard, Raider.IO, Method or Raidbots.
const realFetch = globalThis.fetch;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const routes = [
  ['oauth.battle.net/token', () => json({ access_token: 'fake', expires_in: 86400 })],
  ['/data/wow/realm/index', () => json({ realms: [
    { id: 1305, name: 'Kazzak', slug: 'kazzak' },
    { id: 1096, name: 'Argent Dawn', slug: 'argent-dawn' },
  ] })],
  // A term containing "outage" makes Raider.IO fail, which sends the bar to the manual realm picker.
  ['raider.io/api/search', (url) => url.includes('outage') ? json({}, 500) : json({ matches: [
    { type: 'character', data: { name: 'Birkibjörn', region: { slug: 'eu' }, realm: { name: 'Kazzak', wowRealmId: 1305 }, class: { name: 'Druid' }, faction: 'horde' } },
  ] })],
];

globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return realFetch(input, init);
  const route = routes.find(([needle]) => url.includes(needle));
  if (route) return route[1](url, init);
  return json({ error: `fake-upstream: no route for ${url}` }, 404);
};
