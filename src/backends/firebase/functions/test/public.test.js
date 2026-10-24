const test = require("node:test");
const assert = require("node:assert/strict");
const { currentWeek } = require("../public");
const { setup, leagueWith } = require("./app");

const G = (week, awayId, homeScore = null, awayScore = null) => ({ week, awayId, homeScore, awayScore });

test("currentWeek: lowest week with an unplayed non-bye game; the last week when all played; null without games", () => {
  assert.equal(currentWeek([]), null);
  assert.equal(currentWeek([G(1, "x", 1, 0), G(2, "x"), G(3, "x")]), 2);
  assert.equal(currentWeek([G(1, "x", 1, 0), G(2, "x", 0, 1)]), 2);
  assert.equal(currentWeek([G(1, "x", 1, null), G(2, "x", 1, 0)]), 1); // half-scored is unplayed
  assert.equal(currentWeek([G(1, "x", 1, 0), G(1, null), G(2, "x")]), 2); // a bye never holds a week open
  assert.equal(currentWeek([G(1, "x", 1, 0), G(2, null)]), 2);
});

async function ready(n = 6, extra = {}) {
  const s = setup();
  const id = await leagueWith(s.call, n, { name: "Tuesday Cornhole", location: "Joe's Tavern", sport: "Cornhole", season: "Fall 2026", ...extra });
  await s.call("a", "POST", `/api/leagues/${id}/schedule`);
  const slug = (await s.call("a", "GET", `/api/leagues/${id}`))[1].slug;
  const games = (await s.call("a", "GET", `/api/leagues/${id}/games`))[1];
  const score = (week) => Promise.all(games.filter((g) => g.away_id && (week === undefined || g.week === week))
    .map((g) => s.call("a", "PUT", `/api/games/${g.id}/score`, { home_score: 21, away_score: 14 })));
  return { ...s, id, slug, games, score, pub: (slugValue = slug, who = undefined) => s.call(who, "GET", `/api/public/${slugValue}`) };
}

test("no token: league without id or organizerId, games, standings, current week", async () => {
  const { pub, slug } = await ready();
  const [status, body] = await pub();
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body), ["league", "current_week", "games", "standings"]);
  assert.deepEqual(body.league, { slug, name: "Tuesday Cornhole", location: "Joe's Tavern", sport: "Cornhole", season: "Fall 2026", weeks: 5, allow_ties: false });
  assert.equal(body.games.length, 15);
  assert.equal(body.standings.played, 0);
  assert.equal(body.standings.rows.length, 6);
  assert.equal(body.current_week, 1);
});

test("a bad Authorization header makes no difference", async () => {
  const { pub } = await ready(4);
  assert.equal((await pub(undefined, "nonsense"))[0], 200);
});

test("current_week follows the scores", async () => {
  const { pub, score } = await ready();
  await score(1);
  assert.equal((await pub())[1].current_week, 2);
  await score();
  const body = (await pub())[1];
  assert.deepEqual([body.current_week, body.standings.played], [5, 15]);
});

test("a bye does not hold the week open", async () => {
  const { pub, score } = await ready(3);
  await score(1);
  assert.equal((await pub())[1].current_week, 2);
  await score();
  assert.equal((await pub())[1].current_week, 3);
});

test("no schedule: null current_week, no games, standings list the entrants", async () => {
  const s = setup();
  const id = await leagueWith(s.call, 2);
  const slug = (await s.call("a", "GET", `/api/leagues/${id}`))[1].slug;
  const [, body] = await s.call(undefined, "GET", `/api/public/${slug}`);
  assert.deepEqual([body.current_week, body.games, body.standings.rows.length], [null, [], 2]);
});

test("unknown slug is 404; a malformed slug is 404 with no store call", async () => {
  const { pub, store } = await ready(2);
  assert.deepEqual(await pub("zzzzzz"), [404, { error: "League not found" }]);
  store.calls.length = 0;
  for (const bad of ["ZZZZZZ", "abcde", "abcdefg", "abcdi2", "abc0ef", "abc1ef", "abcdel", "abcdeo", "..", "a%2Fbcde", "abcde%20"]) {
    assert.deepEqual(await pub(bad), [404, { error: "League not found" }], bad);
  }
  assert.deepEqual(store.calls, []);
});

test("the public route only reads", async () => {
  const { call, slug } = await ready(2);
  for (const m of ["POST", "PUT", "DELETE"]) assert.equal((await call("a", m, `/api/public/${slug}`))[0], 405);
});
