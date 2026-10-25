// Leagues and entrants. All storage goes through `store` (firestore-store.js in the function, a map in tests).
// Every route is reached through ownedLeague: a malformed id never reaches the store, and someone else's league is a 404.
const crypto = require("node:crypto");
const { fail, objectBody } = require("./http");

const NAME_LIMIT = 100;
const WEEKS_MAX = 52;
const ENTRANT_LIMIT = 52; // a round robin of 53 needs 53 weeks, and a league runs at most 52
const ID_SHAPE = /^[0-9a-f]{32}$/;
const NOT_FOUND = "League not found";

const codePoints = (s) => [...s].length;
const text = (v) => (typeof v === "string" ? v.trim() : "");
const newId = () => crypto.randomBytes(16).toString("hex");

const leagueJson = (l) => ({
  id: l.id, slug: l.slug, name: l.name, location: l.location, sport: l.sport, season: l.season, weeks: l.weeks, allow_ties: l.allowTies,
});

/** deps: store, plus newId, now and newSlug (injectable for tests). */
function createLeagues(deps) {
  const { store, newSlug } = deps;
  const makeId = deps.newId ?? newId;
  const now = deps.now ?? Date.now;

  /** The league document if it is this organizer's; wrongly shaped, unknown and someone else's all look the same. */
  async function ownedLeague(id, organizer) {
    if (typeof id !== "string" || !ID_SHAPE.test(id)) return fail(404, NOT_FOUND);
    const league = await store.getLeague(id);
    if (!league || league.organizerId !== organizer.id) return fail(404, NOT_FOUND);
    return league;
  }

  async function list(organizer) {
    const rows = await store.listLeagues(organizer.id);
    rows.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return [200, rows.map(leagueJson)];
  }

  async function create(organizer, data) {
    const name = text(data.name);
    const location = text(data.location);
    const allowTies = Object.hasOwn(data, "allow_ties") ? data.allow_ties : false; // null is not a boolean
    if (!name) fail(400, "Name is required");
    if (codePoints(name) > NAME_LIMIT) fail(400, `Name must be ${NAME_LIMIT} characters or fewer`);
    if (!location) fail(400, "Location is required");
    const weeks = data.weeks; // JSON gives 3.0 as 3; booleans and strings are not numbers
    if (typeof weeks !== "number" || !Number.isInteger(weeks) || weeks < 1) fail(400, "Weeks must be at least 1");
    if (weeks > WEEKS_MAX) fail(400, `Weeks must be between 1 and ${WEEKS_MAX}`);
    if (typeof allowTies !== "boolean") fail(400, "Invalid request");
    for (let attempt = 0; attempt < 5; attempt++) { // a taken slug just draws another
      const league = {
        id: makeId(), organizerId: organizer.id, slug: newSlug(), name, location,
        sport: text(data.sport), season: text(data.season), weeks, allowTies, createdAt: now(),
      };
      if (await store.createLeague(league)) return [201, leagueJson(league)];
    }
    return fail(409, "Could not create the league, try again");
  }

  async function get(organizer, id) {
    return [200, leagueJson(await ownedLeague(id, organizer))];
  }

  async function listEntrants(organizer, id) {
    await ownedLeague(id, organizer);
    const rows = await store.listEntrants(id);
    rows.sort((a, b) => a.position - b.position);
    return [200, rows.map((e) => ({ id: e.id, name: e.name }))];
  }

  async function addEntrant(organizer, id, data) {
    await ownedLeague(id, organizer);
    const name = text(data.name);
    if (!name) fail(400, "Name is required");
    if (codePoints(name) > NAME_LIMIT) fail(400, `Name must be ${NAME_LIMIT} characters or fewer`);
    // The store runs this with the league's current entrants inside one transaction with the insert.
    const entrant = await store.addEntrant(id, (existing) => {
      if (existing.some((e) => e.name.trim().toLowerCase() === name.toLowerCase())) {
        fail(409, "An entrant with that name already exists in this league");
      }
      if (existing.length >= ENTRANT_LIMIT) fail(400, `A league can have at most ${ENTRANT_LIMIT} entrants`);
      const position = existing.reduce((m, e) => Math.max(m, e.position), -1) + 1;
      return { id: makeId(), name, position };
    });
    return [201, { id: entrant.id, name: entrant.name }];
  }

  return { ownedLeague, list, create, get, listEntrants, addEntrant };
}

module.exports = { createLeagues, leagueJson, NAME_LIMIT, WEEKS_MAX, ENTRANT_LIMIT };
