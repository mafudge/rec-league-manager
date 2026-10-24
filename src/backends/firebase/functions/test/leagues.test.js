const test = require("node:test");
const assert = require("node:assert/strict");
const { createLeagues } = require("../leagues");
const { createSlugs } = require("../slugs");
const { dispatch, ApiError } = require("../http");
const { createRoutes } = require("../routes");

// An in-memory stand-in for the Firestore store: same interface as firestore-store.js.
function memoryStore() {
  const leagues = new Map();
  const entrants = new Map();
  const slugs = new Set();
  const calls = [];
  const rec = (name, fn) => (...a) => { calls.push(name); return fn(...a); };
  return {
    calls,
    getLeague: rec("getLeague", async (id) => leagues.get(id) ?? null),
    listLeagues: rec("listLeagues", async (uid) => [...leagues.values()].filter((l) => l.organizerId === uid)),
    createLeague: rec("createLeague", async (league) => {
      if (slugs.has(league.slug)) return false;
      slugs.add(league.slug);
      leagues.set(league.id, league);
      return true;
    }),
    listEntrants: rec("listEntrants", async (id) => entrants.get(id) ?? []),
    addEntrant: rec("addEntrant", async (id, decide) => {
      const list = entrants.get(id) ?? [];
      const e = decide(list);
      entrants.set(id, [...list, e]);
      return e;
    }),
  };
}

function setup() {
  const store = memoryStore();
  let n = 0;
  const leagues = createLeagues({ store, newId: () => (++n).toString(16).padStart(32, "0"), now: () => n, newSlug: createSlugs().newSlug });
  const users = { a: { id: "uA", email: "a@x.com" }, b: { id: "uB", email: "b@x.com" } };
  const auth = { organizerFrom: async (req) => users[req.headers.authorization] ?? Promise.reject(new ApiError(401, "Sign in required")) };
  const routes = createRoutes(auth, leagues);
  const call = (who, method, path, body) =>
    dispatch({ method, path, headers: { authorization: who }, rawBody: body === undefined ? "" : JSON.stringify(body) }, routes);
  return { store, call };
}
const LEAGUE = { name: "Tuesday Cornhole", location: "Joe's Tavern", weeks: 8 };

test("create returns a League with a 32-hex id and a 6-character slug; trims; defaults", async () => {
  const { call } = setup();
  const [status, body] = await call("a", "POST", "/api/leagues", { ...LEAGUE, name: "  Tue  ", sport: " Cornhole ", season: "Fall" });
  assert.equal(status, 201);
  assert.match(body.id, /^[0-9a-f]{32}$/);
  assert.match(body.slug, /^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
  assert.deepEqual({ ...body, id: 0, slug: 0 }, { id: 0, slug: 0, name: "Tue", location: "Joe's Tavern", sport: "Cornhole", season: "Fall", weeks: 8, allow_ties: false });
  const [, plain] = await call("a", "POST", "/api/leagues", { name: "A", location: "B", weeks: 3, allow_ties: true });
  assert.deepEqual([plain.sport, plain.season, plain.allow_ties], ["", "", true]);
});

test("create validation order and messages", async () => {
  const { call } = setup();
  const bad = async (body, message) => assert.deepEqual(await call("a", "POST", "/api/leagues", body), [400, { error: message }], JSON.stringify(body));
  await bad({ name: "  ", location: "B", weeks: 3 }, "Name is required");
  await bad({ name: 5, location: "B", weeks: 3 }, "Name is required");
  await bad({ name: "a".repeat(101), location: "", weeks: "x" }, "Name must be 100 characters or fewer");
  await bad({ name: "A", location: " ", weeks: 0 }, "Location is required");
  for (const w of [0, -1, "8", 2.5, null, true, undefined]) await bad({ name: "A", location: "B", weeks: w }, "Weeks must be at least 1");
  for (const w of [53, 3000000000]) await bad({ name: "A", location: "B", weeks: w }, "Weeks must be between 1 and 52");
  for (const t of ["yes", null, 1]) await bad({ name: "A", location: "B", weeks: 3, allow_ties: t }, "Invalid request");
  await bad([], "Invalid request");
  await bad({ name: "A\u0000", location: "B", weeks: 3 }, "Invalid request");
});

test("name length counts code points; weeks 3.0 is 3", async () => {
  const { call } = setup();
  assert.equal((await call("a", "POST", "/api/leagues", { name: "😀".repeat(100), location: "B", weeks: 3 }))[0], 201);
  const [status, body] = await call("a", "POST", "/api/leagues", { name: "A", location: "B", weeks: 3.0 });
  assert.deepEqual([status, body.weeks], [201, 3]);
});

test("a taken slug is retried; five taken in a row is 409", async () => {
  const store = memoryStore();
  const real = store.createLeague;
  let tries = 0;
  store.createLeague = async (l) => { tries++; return tries < 3 ? false : real(l); };
  const leagues = createLeagues({ store, newId: () => "0".repeat(32), now: () => 1, newSlug: createSlugs().newSlug });
  assert.equal((await leagues.create({ id: "u" }, LEAGUE))[0], 201);
  assert.equal(tries, 3);
  store.createLeague = async () => false;
  await assert.rejects(leagues.create({ id: "u" }, LEAGUE), { status: 409, message: "Could not create the league, try again" });
});

test("list is only mine, oldest first by createdAt then id", async () => {
  const { call } = setup();
  const ids = [];
  for (const n of ["one", "two", "three"]) ids.push((await call("a", "POST", "/api/leagues", { ...LEAGUE, name: n }))[1].id);
  await call("b", "POST", "/api/leagues", LEAGUE);
  const [, mine] = await call("a", "GET", "/api/leagues");
  assert.deepEqual(mine.map((l) => l.id), ids);
  assert.equal((await call("b", "GET", "/api/leagues"))[1].length, 1);
  assert.deepEqual(Object.keys(mine[0]), ["id", "slug", "name", "location", "sport", "season", "weeks", "allow_ties"]);
});

test("every league and entrant route is 404 for another organizer", async () => {
  const { call } = setup();
  const id = (await call("a", "POST", "/api/leagues", LEAGUE))[1].id;
  for (const [method, path, body] of [
    ["GET", `/api/leagues/${id}`],
    ["GET", `/api/leagues/${id}/entrants`],
    ["POST", `/api/leagues/${id}/entrants`, { name: "X" }],
  ]) {
    assert.deepEqual(await call("b", method, path, body), [404, { error: "League not found" }], path);
  }
  assert.equal((await call("a", "GET", `/api/leagues/${id}`))[0], 200);
});

test("no token is 401 on every route", async () => {
  const { call } = setup();
  for (const [method, path] of [["GET", "/api/leagues"], ["POST", "/api/leagues"], ["GET", `/api/leagues/${"a".repeat(32)}`], ["GET", `/api/leagues/${"a".repeat(32)}/entrants`], ["POST", `/api/leagues/${"a".repeat(32)}/entrants`]]) {
    const [status] = await call("nobody", method, path, {});
    assert.equal(status, 401, path);
  }
});

test("an id that is not 32 lowercase hex is 404 without touching the store", async () => {
  const { call, store } = setup();
  for (const id of ["..", "x", "a%2Fb", "%2E%2E%2Fx", "a".repeat(31), "A".repeat(32), "a".repeat(33), "g".repeat(32)]) {
    for (const [method, suffix, body] of [["GET", ""], ["GET", "/entrants"], ["POST", "/entrants", { name: "X" }]]) {
      assert.deepEqual(await call("a", method, `/api/leagues/${id}${suffix}`, body), [404, { error: "League not found" }], id + suffix);
    }
  }
  // a literal slash makes the path a different route (unknown), still never a store call
  assert.equal((await call("a", "GET", "/api/leagues/a/b"))[0], 404);
  assert.equal((await call("a", "GET", "/api/leagues//entrants"))[0], 404);
  assert.deepEqual(store.calls, []);
  assert.deepEqual(await call("a", "GET", `/api/leagues/${"f".repeat(32)}`), [404, { error: "League not found" }]);
  assert.deepEqual(store.calls, ["getLeague"]);
});

async function league(call, who = "a") { return (await call(who, "POST", "/api/leagues", LEAGUE))[1].id; }

test("entrants: add, trim, list in order, shape {id, name}", async () => {
  const { call } = setup();
  const id = await league(call);
  const [status, e] = await call("a", "POST", `/api/leagues/${id}/entrants`, { name: "  Bag Ladies " });
  assert.equal(status, 201);
  assert.deepEqual(Object.keys(e), ["id", "name"]);
  assert.match(e.id, /^[0-9a-f]{32}$/);
  assert.equal(e.name, "Bag Ladies");
  for (const n of ["Zed", "Alpha", "Mid"]) await call("a", "POST", `/api/leagues/${id}/entrants`, { name: n });
  const [, list] = await call("a", "GET", `/api/leagues/${id}/entrants`);
  assert.deepEqual(list.map((x) => x.name), ["Bag Ladies", "Zed", "Alpha", "Mid"]);
});

test("entrants: validation order, duplicates, cap of 52, body checked before league", async () => {
  const { call } = setup();
  const id = await league(call);
  const url = `/api/leagues/${id}/entrants`;
  const bad = async (body, status, message) => assert.deepEqual(await call("a", "POST", url, body), [status, { error: message }], JSON.stringify(body));
  for (const n of ["", "   ", null, 5, true, ["x"], undefined]) await bad({ name: n }, 400, "Name is required");
  await bad({ name: "a".repeat(101) }, 400, "Name must be 100 characters or fewer");
  await bad({ name: "Team\u0000" }, 400, "Invalid request");
  await bad([], 400, "Invalid request");
  await call("a", "POST", url, { name: "Bag Ladies" });
  for (const d of ["Bag Ladies", " bag ladies ", "BAG LADIES"]) await bad({ name: d }, 409, "An entrant with that name already exists in this league");
  for (let i = 1; i < 52; i++) assert.equal((await call("a", "POST", url, { name: `T${i}` }))[0], 201);
  await bad({ name: "one more" }, 400, "A league can have at most 52 entrants");
  await bad({ name: "bag ladies" }, 409, "An entrant with that name already exists in this league");
  assert.equal((await call("a", "GET", url))[1].length, 52);
  // body shape is checked before the league lookup
  assert.deepEqual(await call("b", "POST", url, []), [400, { error: "Invalid request" }]);
});
