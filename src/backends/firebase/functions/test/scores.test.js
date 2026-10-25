const test = require("node:test");
const assert = require("node:assert/strict");
const { setup, leagueWith } = require("./app");

const WHOLE = [400, { error: "Scores must be whole numbers 0 or greater" }];
const NOT_FOUND = [404, { error: "Game not found" }];

async function ready(n = 4, extra = {}) {
  const s = setup();
  const id = await leagueWith(s.call, n, extra);
  await s.call("a", "POST", `/api/leagues/${id}/schedule`);
  const games = (await s.call("a", "GET", `/api/leagues/${id}/games`))[1];
  const game = games.find((g) => g.away_id);
  return { ...s, id, games, game, put: (body, who = "a", gid = game.id) => s.call(who, "PUT", `/api/games/${gid}/score`, body) };
}

test("a score is saved, shown on the game and replaced by a second PUT", async () => {
  const { put, call, id, game } = await ready();
  assert.deepEqual(await put({ home_score: 21, away_score: 14 }), [200, { ...game, home_score: 21, away_score: 14 }]);
  assert.deepEqual((await put({ home_score: 3.0, away_score: 0 }))[1].home_score, 3);
  const listed = (await call("a", "GET", `/api/leagues/${id}/games`))[1].find((g) => g.id === game.id);
  assert.deepEqual([listed.home_score, listed.away_score], [3, 0]);
});

test("not whole numbers: refused, nothing stored", async () => {
  const { put, call, id, game } = await ready();
  const bodies = [
    { home_score: -1, away_score: 14 }, { home_score: null, away_score: 14 }, { away_score: 14 }, { home_score: 21.5, away_score: 14 },
    { home_score: 21, away_score: 14.5 }, { home_score: "21", away_score: 14 }, { home_score: true, away_score: 14 },
    { home_score: 21, away_score: false }, { home_score: 1e30, away_score: 14 }, { home_score: 21, away_score: 2 ** 31 },
    { home_score: [1], away_score: 2 }, { home_score: 1, away_score: {} },
  ];
  for (const b of bodies) assert.deepEqual(await put(b), WHOLE, JSON.stringify(b));
  const listed = (await call("a", "GET", `/api/leagues/${id}/games`))[1].find((g) => g.id === game.id);
  assert.deepEqual([listed.home_score, listed.away_score], [null, null]);
  assert.equal((await put({ home_score: 2 ** 31 - 1, away_score: 0 }))[0], 200);
});

test("both null or {} clears; clearing an unplayed game is a no-op", async () => {
  const { put } = await ready();
  await put({ home_score: 5, away_score: 4 });
  for (const b of [{ home_score: null, away_score: null }, {}]) {
    await put({ home_score: 5, away_score: 4 });
    const [s, g] = await put(b);
    assert.deepEqual([s, g.home_score, g.away_score], [200, null, null]);
  }
  assert.equal((await put({}))[0], 200);
});

test("ties: refused unless the league allows them", async () => {
  const strict = await ready();
  assert.deepEqual(await strict.put({ home_score: 15, away_score: 15 }), [400, { error: "This league doesn't allow ties" }]);
  const ties = await ready(4, { allow_ties: true });
  assert.equal((await ties.put({ home_score: 15, away_score: 15 }))[0], 200);
});

test("a bye has no score, even for a clear; checked before the number rules", async () => {
  const { call, put } = await ready(3);
  const id = (await call("a", "GET", "/api/leagues"))[1][0].id;
  const bye = (await call("a", "GET", `/api/leagues/${id}/games`))[1].find((g) => !g.away_id);
  for (const b of [{ home_score: 1, away_score: 0 }, {}, { home_score: "x" }]) {
    assert.deepEqual(await put(b, "a", bye.id), [400, { error: "A bye has no score" }]);
  }
});

test("check order: body shape, then 404, then bye/numbers", async () => {
  const { raw, put, game } = await ready();
  for (const body of ["[1]", '"x"', "5", "nope", ""]) {
    assert.deepEqual(await raw("a", "PUT", `/api/games/${game.id}/score`, body), [400, { error: "Invalid request" }]);
    assert.deepEqual(await raw("a", "PUT", "/api/games/nonsense/score", body), [400, { error: "Invalid request" }]);
  }
  assert.deepEqual(await put({ home_score: "x" }, "b"), NOT_FOUND); // other organizer
  assert.deepEqual(await put({ home_score: 1, away_score: 0 }, "b"), NOT_FOUND);
});

test("game ids: malformed never reach the store; unknown league, stale generation and missing index are 404", async () => {
  const { put, store, game } = await ready();
  const [lg, gen, idx] = game.id.split(".");
  store.calls.length = 0;
  const malformed = ["x", "a.b.c", `${lg}.${gen}`, `${lg}.${gen}.1.2`, `${lg}.${gen}.-1`, `${lg}.${gen}.12345`, `${lg}.${"A".repeat(8)}.0`, `${"A".repeat(32)}.${gen}.0`, `${lg}/..${gen}.0`, `../${lg}.${gen}.0`, `${lg}.${gen}.0 `];
  for (const m of malformed) assert.deepEqual(await put({ home_score: 1, away_score: 0 }, "a", encodeURIComponent(m)), NOT_FOUND, m);
  assert.deepEqual(store.calls, []);
  const ok = { home_score: 1, away_score: 0 };
  assert.deepEqual(await put(ok, "a", `${"0".repeat(32)}.${gen}.${idx}`), NOT_FOUND);
  assert.deepEqual(await put(ok, "a", `${lg}.${"f".repeat(8)}.${idx}`), NOT_FOUND);
  assert.deepEqual(await put(ok, "a", `${lg}.${gen}.99`), NOT_FOUND);
  assert.deepEqual(await put(ok, "a", `${lg}.${gen}.${idx}`).then((r) => r[0]), 200);
});

test("a regenerated schedule orphans the old game ids", async () => {
  const { put, call, id } = await ready();
  await call("a", "POST", `/api/leagues/${id}/schedule`);
  assert.deepEqual(await put({ home_score: 1, away_score: 0 }), NOT_FOUND);
});

test("a 0-0 score saves in a league that allows ties", async () => {
  const { put } = await ready(4, { allow_ties: true });
  const [status, g] = await put({ home_score: 0, away_score: 0 });
  assert.deepEqual([status, g.home_score, g.away_score], [200, 0, 0]);
});

test("one null beside a number is refused and the score already saved survives", async () => {
  const { put, call, id, game } = await ready();
  await put({ home_score: 21, away_score: 14 });
  assert.deepEqual(await put({ home_score: null, away_score: 14 }), WHOLE);
  assert.deepEqual(await put({ home_score: 21, away_score: null }), WHOLE);
  assert.deepEqual(await put({ away_score: 3 }), WHOLE);
  const listed = (await call("a", "GET", `/api/leagues/${id}/games`))[1].find((g) => g.id === game.id);
  assert.deepEqual([listed.home_score, listed.away_score], [21, 14]);
});

test("signed out: 401 on the score route, whatever the game id", async () => {
  const { put, game } = await ready();
  assert.deepEqual(await put({ home_score: 1, away_score: 0 }, "nobody"), [401, { error: "Sign in required" }]);
  assert.deepEqual(await put({ home_score: 1, away_score: 0 }, "nobody", "nonsense"), [401, { error: "Sign in required" }]);
  assert.equal(game.home_score, null);
});

test("the index is canonical: a leading zero is not a game", async () => {
  const { put, game, store } = await ready();
  const [lg, gen] = game.id.split(".");
  store.calls.length = 0;
  for (const idx of ["01", "00", "0001"]) assert.deepEqual(await put({ home_score: 1, away_score: 0 }, "a", `${lg}.${gen}.${idx}`), NOT_FOUND, idx);
  assert.deepEqual(store.calls, []);
});
