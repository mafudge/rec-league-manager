const test = require("node:test");
const assert = require("node:assert/strict");
const { roundRobin } = require("../schedule");
const { isPlayed, playedCount } = require("../standings");
const { setup, leagueWith } = require("./app");
const fixture = require("./fixtures/round_robin_fastapi.json");

const ids = (n) => Array.from({ length: n }, (_, i) => `e${String(i).padStart(2, "0")}`);

test("roundRobin equals FastAPI's schedule from the fixture, for every n in it", () => {
  const sizes = Object.keys(fixture);
  assert.ok(sizes.length >= 5);
  for (const n of sizes) assert.deepEqual(roundRobin(ids(Number(n))), fixture[n], `n=${n}`);
});

test("roundRobin properties for n = 2..52", () => {
  for (let n = 2; n <= 52; n++) {
    const weeks = roundRobin(ids(n));
    assert.equal(weeks.length, n % 2 ? n : n - 1, `n=${n} weeks`);
    const met = new Set();
    const home = {}, away = {}, byes = {};
    for (const week of weeks) {
      const seen = new Set();
      for (const [h, a] of week) {
        for (const id of [h, a]) if (id !== null) { assert.ok(!seen.has(id), `n=${n} twice in a week`); seen.add(id); }
        if (a === null) { byes[h] = (byes[h] ?? 0) + 1; continue; }
        const key = [h, a].sort().join("|");
        assert.ok(!met.has(key), `n=${n} pair repeated`);
        met.add(key);
        home[h] = (home[h] ?? 0) + 1;
        away[a] = (away[a] ?? 0) + 1;
      }
      assert.equal(seen.size, n); // everyone plays or has the bye
    }
    assert.equal(met.size, (n * (n - 1)) / 2, `n=${n} every pair once`);
    for (const id of ids(n)) {
      assert.ok(Math.abs((home[id] ?? 0) - (away[id] ?? 0)) <= 1, `n=${n} ${id} home/away`);
      if (n % 2) assert.equal(byes[id], 1);
    }
  }
});

test("isPlayed and playedCount ignore byes and half-scored games", () => {
  const games = [
    { awayId: "x", homeScore: 1, awayScore: 0 },
    { awayId: "x", homeScore: null, awayScore: null },
    { awayId: "x", homeScore: 1, awayScore: null },
    { awayId: null, homeScore: 1, awayScore: 1 },
  ];
  assert.deepEqual(games.map(isPlayed), [true, false, false, false]);
  assert.equal(playedCount(games), 1);
});

const gamesOf = async (call, id) => (await call("a", "GET", `/api/leagues/${id}/games`))[1];

test("generate: 201 weeks and message, league weeks updated, games listed in order with names", async () => {
  const { call } = setup();
  const id = await leagueWith(call, 6);
  assert.deepEqual(await call("a", "GET", `/api/leagues/${id}/games`), [200, []]);
  assert.deepEqual(await call("a", "POST", `/api/leagues/${id}/schedule`), [201, { weeks: 5, message: "This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8." }]);
  assert.equal((await call("a", "GET", `/api/leagues/${id}`))[1].weeks, 5);
  const games = await gamesOf(call, id);
  assert.equal(games.length, 15);
  assert.deepEqual(games.map((g) => g.week), [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  assert.equal(games[0].home_name, "Team 0");
  assert.deepEqual(Object.keys(games[0]), ["id", "week", "home_id", "home_name", "away_id", "away_name", "home_score", "away_score"]);
  assert.match(games[0].id, new RegExp(`^${id}\\.[0-9a-f]{8}\\.0$`));
  assert.deepEqual(await call("a", "POST", `/api/leagues/${id}/schedule`), [201, { weeks: 5, message: null }]); // weeks already match
});

test("generate: singular week, bye shape, too few entrants, other organizer, malformed id", async () => {
  const { call, store } = setup();
  const two = await leagueWith(call, 2);
  assert.deepEqual((await call("a", "POST", `/api/leagues/${two}/schedule`))[1].message, "This schedule needs 1 week, so the league now runs 1 week instead of 8.");
  const three = await leagueWith(call, 3);
  await call("a", "POST", `/api/leagues/${three}/schedule`);
  const bye = (await gamesOf(call, three)).find((g) => g.away_id === null);
  assert.deepEqual([bye.away_name, bye.home_score, bye.away_score], [null, null, null]);
  const one = await leagueWith(call, 1);
  assert.deepEqual(await call("a", "POST", `/api/leagues/${one}/schedule`), [400, { error: "Add at least 2 entrants first" }]);
  assert.deepEqual(await call("b", "POST", `/api/leagues/${two}/schedule`), [404, { error: "League not found" }]);
  assert.deepEqual(await call("b", "GET", `/api/leagues/${two}/games`), [404, { error: "League not found" }]);
  assert.deepEqual(await call("b", "DELETE", `/api/leagues/${two}/scores`), [404, { error: "League not found" }]);
  store.calls.length = 0;
  for (const bad of ["x", "..", "a%2Fb", "G".repeat(32)]) {
    for (const [m, p] of [["POST", "schedule"], ["GET", "games"], ["DELETE", "scores"]]) {
      assert.deepEqual(await call("a", m, `/api/leagues/${bad}/${p}`), [404, { error: "League not found" }]);
    }
  }
  assert.deepEqual(store.calls, []);
  assert.equal((await call("a", "GET", `/api/leagues/${two}/schedule`))[0], 405);
});

test("regenerate changes every game id; refused with 409 once a score exists; clear keeps ids", async () => {
  const { call } = setup();
  const id = await leagueWith(call, 4, { allow_ties: true });
  await call("a", "POST", `/api/leagues/${id}/schedule`);
  const first = await gamesOf(call, id);
  await call("a", "POST", `/api/leagues/${id}/schedule`);
  const second = await gamesOf(call, id);
  assert.equal(new Set([...first, ...second].map((g) => g.id)).size, 12);
  await call("a", "PUT", `/api/games/${second[0].id}/score`, { home_score: 1, away_score: 0 });
  assert.deepEqual(await call("a", "POST", `/api/leagues/${id}/schedule`), [409, { error: "Scores already recorded — clear them first" }]);
  assert.deepEqual((await gamesOf(call, id)).map((g) => g.id), second.map((g) => g.id));
  assert.deepEqual(await call("a", "DELETE", `/api/leagues/${id}/scores`), [200, { cleared: 1 }]);
  assert.deepEqual(await call("a", "DELETE", `/api/leagues/${id}/scores`), [200, { cleared: 0 }]);
  const after = await gamesOf(call, id);
  assert.deepEqual(after.map((g) => g.id), second.map((g) => g.id));
  assert.equal(after[0].home_score, null);
  assert.equal((await call("a", "POST", `/api/leagues/${id}/schedule`))[0], 201);
});

test("clearing with no schedule is cleared 0", async () => {
  const { call } = setup();
  const id = await leagueWith(call, 3);
  assert.deepEqual(await call("a", "DELETE", `/api/leagues/${id}/scores`), [200, { cleared: 0 }]);
});
