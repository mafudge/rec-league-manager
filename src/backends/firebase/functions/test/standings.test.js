const test = require("node:test");
const assert = require("node:assert/strict");
const { computeStandings, standingsJson, TIEBREAK } = require("../standings");
const { setup, leagueWith } = require("./app");

const [A, B, C, D] = [
  { id: "1", name: "Bag Ladies" }, { id: "2", name: "Corn Stars" }, { id: "3", name: "Hole Patrol" }, { id: "4", name: "Sack Attack" },
];
const G = (week, homeId, awayId, homeScore = null, awayScore = null) => ({ week, homeId, awayId, homeScore, awayScore });
const table = (rows) => rows.map((r) => [r.name, r.w, r.l, r.pf, r.pa, r.diff]);

test("AC1: played games give W L PF PA Diff, sorted by W then Diff", () => {
  const games = [G(1, "1", "2", 21, 14), G(1, "3", "4", 21, 20), G(2, "1", "3", 21, 10), G(2, "2", "4", 21, 5)];
  assert.deepEqual(table(computeStandings([A, B, C, D], games)), [
    ["Bag Ladies", 2, 0, 42, 24, 18], ["Corn Stars", 1, 1, 35, 26, 9], ["Hole Patrol", 1, 1, 31, 41, -10], ["Sack Attack", 0, 2, 25, 42, -17],
  ]);
});

test("AC2: equal W and Diff are ordered by PF", () => {
  const games = [G(1, "2", "1", 15, 10), G(2, "2", "4", 5, 10), G(1, "3", "4", 21, 16), G(2, "3", "1", 16, 21)];
  const rows = computeStandings([A, B, C, D], games);
  assert.ok(rows.every((r) => r.w === 1 && r.diff === 0));
  assert.deepEqual(rows.map((r) => [r.name, r.pf]), [["Hole Patrol", 37], ["Bag Ladies", 31], ["Sack Attack", 26], ["Corn Stars", 20]]);
});

test("AC3: nothing played still lists every entrant at zero; no games at all too", () => {
  const rows = computeStandings([A, B, C, D], [G(1, "1", "2"), G(1, "3", "4")]);
  assert.deepEqual(rows.map((r) => [r.w, r.l, r.t, r.pf, r.pa, r.diff]), Array(4).fill([0, 0, 0, 0, 0, 0]));
  assert.equal(computeStandings([A, B, C, D], []).length, 4);
});

test("AC4: unplayed and half-scored games and byes contribute nothing", () => {
  const played = [G(1, "1", "2", 21, 14)];
  const extra = [G(2, "1", "3"), G(2, "2", "4", 21, null), G(3, "1", null)];
  assert.deepEqual(computeStandings([A, B, C, D], [...played, ...extra]), computeStandings([A, B, C, D], played));
});

test("a tie counts points, gives each side a T and no W or L", () => {
  const rows = computeStandings([A, B], [G(1, "1", "2", 15, 15)]);
  assert.deepEqual(table(rows), [["Bag Ladies", 0, 0, 15, 15, 0], ["Corn Stars", 0, 0, 15, 15, 0]]);
  assert.deepEqual(rows.map((r) => r.t), [1, 1]);
});

test("name only makes the order deterministic", () => {
  assert.deepEqual(computeStandings([B, A], []).map((r) => r.name), ["Bag Ladies", "Corn Stars"]);
});

test("US06-01: an unknown entrant or a game against itself is an error, played or not", () => {
  assert.throws(() => computeStandings([A, B], [G(3, "1", "99", 10, 5)]), { message: "Week 3: entrant 99 is not in this league" });
  assert.throws(() => computeStandings([A, B], [G(2, "77", "2")]), { message: "Week 2: entrant 77 is not in this league" });
  assert.throws(() => computeStandings([A, B], [G(3, "2", "2", 10, 5)]), { message: "Week 3: entrant 2 (Corn Stars) can't play itself" });
});

test("standingsJson shape", () => {
  const json = standingsJson(computeStandings([A, B], [G(1, "1", "2", 3, 1)]), 1);
  assert.deepEqual(json, {
    rows: [
      { entrant_id: "1", name: "Bag Ladies", w: 1, l: 0, t: 0, pf: 3, pa: 1, diff: 2 },
      { entrant_id: "2", name: "Corn Stars", w: 0, l: 1, t: 0, pf: 1, pa: 3, diff: -2 },
    ],
    played: 1,
    tiebreak: "Sorted by wins, then point difference, then points for.",
  });
  assert.equal(TIEBREAK, json.tiebreak);
});

// The route
async function ready(n = 6, extra = {}) {
  const s = setup();
  const id = await leagueWith(s.call, n, extra);
  await s.call("a", "POST", `/api/leagues/${id}/schedule`);
  const games = (await s.call("a", "GET", `/api/leagues/${id}/games`))[1].filter((g) => g.away_id);
  const put = (g, h, a) => s.call("a", "PUT", `/api/games/${g.id}/score`, { home_score: h, away_score: a });
  return { ...s, id, games, put, standings: (who = "a") => s.call(who, "GET", `/api/leagues/${id}/standings`) };
}

test("route: no scores lists every entrant with zeros", async () => {
  const { standings } = await ready();
  const [status, body] = await standings();
  assert.equal(status, 200);
  assert.equal(body.played, 0);
  assert.equal(body.tiebreak, TIEBREAK);
  assert.equal(body.rows.length, 6);
  assert.ok(body.rows.every((r) => Object.keys(r).join() === "entrant_id,name,w,l,t,pf,pa,diff" && r.w + r.l + r.t + r.pf + r.pa + r.diff === 0));
});

test("route: two scores are computed and ordered; clearing resets; computed on every request", async () => {
  const { standings, put, games, call, id } = await ready();
  const [g1, g2] = games;
  await put(g1, 21, 14);
  await put(g2, 10, 15);
  const body = (await standings())[1];
  assert.equal(body.played, 2);
  const top = body.rows[0];
  assert.deepEqual([top.entrant_id, top.w, top.l, top.pf, top.pa, top.diff], [g1.home_id, 1, 0, 21, 14, 7]);
  const by = Object.fromEntries(body.rows.map((r) => [r.entrant_id, r]));
  assert.deepEqual([by[g2.away_id].w, by[g2.away_id].diff, by[g2.home_id].l, by[g2.home_id].diff], [1, 5, 1, -5]);
  assert.deepEqual(body.rows.map((r) => r.w), [1, 1, 0, 0, 0, 0]);
  await call("a", "DELETE", `/api/leagues/${id}/scores`);
  assert.equal((await standings())[1].played, 0);
});

test("route: ties give each side a T", async () => {
  const { standings, put, games } = await ready(4, { allow_ties: true });
  await put(games[0], 5, 5);
  const by = Object.fromEntries((await standings())[1].rows.map((r) => [r.entrant_id, r]));
  assert.deepEqual([by[games[0].home_id].t, by[games[0].home_id].w, by[games[0].away_id].t], [1, 0, 1]);
});

test("route: another organizer, signed out and a malformed id", async () => {
  const { standings, call, store } = await ready();
  assert.deepEqual(await standings("b"), [404, { error: "League not found" }]);
  assert.deepEqual(await standings("nobody"), [401, { error: "Sign in required" }]);
  store.calls.length = 0;
  assert.deepEqual(await call("a", "GET", "/api/leagues/x/standings"), [404, { error: "League not found" }]);
  assert.deepEqual(store.calls, []);
  assert.equal((await call("a", "POST", "/api/leagues/x/standings"))[0], 405);
});

test("route: a league with no schedule has no rows beyond its entrants", async () => {
  const s = setup();
  const id = await leagueWith(s.call, 2);
  const [, body] = await s.call("a", "GET", `/api/leagues/${id}/standings`);
  assert.equal(body.rows.length, 2);
  assert.equal(body.played, 0);
});
