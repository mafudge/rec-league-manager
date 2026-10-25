// Shared test wiring: routes over the in-memory store, two signed-in organizers ("a" and "b").
const { createLeagues } = require("../leagues");
const { createSchedule } = require("../schedule");
const { createScores } = require("../scores");
const { createStandings } = require("../standings");
const { createPublic } = require("../public");
const { createSlugs } = require("../slugs");
const { dispatch, ApiError } = require("../http");
const { createRoutes } = require("../routes");
const { memoryStore } = require("./memory-store");

function setup() {
  const store = memoryStore();
  let n = 0;
  const leagues = createLeagues({ store, newId: () => (++n).toString(16).padStart(32, "0"), now: () => n, newSlug: createSlugs().newSlug });
  let g = 0;
  const schedule = createSchedule({ store, leagues, newGeneration: () => (++g).toString(16).padStart(8, "0") });
  const scores = createScores({ store, leagues });
  const users = { a: { id: "uA", email: "a@x.com" }, b: { id: "uB", email: "b@x.com" } };
  const auth = { organizerFrom: async (req) => users[req.headers.authorization] ?? Promise.reject(new ApiError(401, "Sign in required")) };
  const routes = createRoutes(auth, leagues, schedule, scores, createStandings({ store, leagues }), createPublic({ store }));
  const call = (who, method, path, body) =>
    dispatch({ method, path, headers: who === undefined ? {} : { authorization: who }, rawBody: body === undefined ? "" : JSON.stringify(body) }, routes);
  const raw = (who, method, path, rawBody) => dispatch({ method, path, headers: who === undefined ? {} : { authorization: who }, rawBody }, routes);
  return { store, call, raw };
}

/** A league for organizer "a" with `n` entrants (Team 0..), returns its id. */
async function leagueWith(call, n, extra = {}) {
  const [, league] = await call("a", "POST", "/api/leagues", { name: "L", location: "B", weeks: 8, ...extra });
  for (let i = 0; i < n; i++) await call("a", "POST", `/api/leagues/${league.id}/entrants`, { name: `Team ${i}` });
  return league.id;
}

module.exports = { setup, leagueWith };
