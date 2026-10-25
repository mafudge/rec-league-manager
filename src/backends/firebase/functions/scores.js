// Recording a score. The game id is `<leagueId>.<generation>.<index>`, so the league is found without a query.
const { fail } = require("./http");
const { gameJson, namesOf } = require("./schedule");

const GAME_ID = /^([0-9a-f]{32})\.([0-9a-f]{8})\.(0|[1-9]\d{0,3})$/;
const LIMIT = 2 ** 31; // int4, so every backend agrees on what fits
const NOT_FOUND = "Game not found";

/** The score as an integer, or null if it isn't one. JSON gives 21.0 as 21; booleans and strings are not numbers. */
const whole = (v) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < LIMIT ? v : null);

/** deps: store, leagues (ownedLeague). */
function createScores({ store, leagues }) {
  async function record(organizer, gameId, data) {
    const m = typeof gameId === "string" ? GAME_ID.exec(gameId) : null;
    if (!m) return fail(404, NOT_FOUND); // nothing malformed reaches Firestore
    const [, leagueId, generation, indexText] = m;
    const index = Number(indexText);
    const league = await leagues.ownedLeague(leagueId, organizer).catch((e) => (e.status === 404 ? fail(404, NOT_FOUND) : Promise.reject(e)));

    const result = await store.updateSchedule(leagueId, (schedule) => {
      if (!schedule || schedule.generation !== generation || index >= schedule.games.length) fail(404, NOT_FOUND);
      const game = schedule.games[index];
      if (game.awayId === null) fail(400, "A bye has no score");
      let home = null;
      let away = null;
      if (data.home_score != null || data.away_score != null) { // both null or absent clears; one null beside a number is refused
        home = whole(data.home_score);
        away = whole(data.away_score);
        if (home === null || away === null) fail(400, "Scores must be whole numbers 0 or greater");
        if (home === away && !league.allowTies) fail(400, "This league doesn't allow ties");
      }
      const games = schedule.games.map((g, i) => (i === index ? { ...g, homeScore: home, awayScore: away } : g));
      return { schedule: { ...schedule, games }, result: { game: games[index], generation } };
    });
    const names = namesOf(await store.listEntrants(leagueId));
    return [200, gameJson(leagueId, result.generation, result.game, index, names)];
  }

  return { record };
}

module.exports = { createScores, GAME_ID };
