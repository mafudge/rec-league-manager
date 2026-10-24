// US07: the public page. No token: anyone with the link reads the league, schedule and standings; nothing writes.
// A port of backends/fastapi/app/routes/public.py. It reads by slug only and never returns the league id or organizerId.
const { fail } = require("./http");
const { ALPHABET, LENGTH } = require("./slugs");
const { gameJson, namesOf } = require("./schedule");
const { computeStandings, standingsJson, isPlayed, playedCount } = require("./standings");
const { leagueJson } = require("./leagues");

const SLUG = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);
const NOT_FOUND = "League not found";

/** Lowest week with an unplayed non-bye game; the last week once everything is played; null with no games. */
function currentWeek(games) {
  if (games.length === 0) return null;
  const open = games.filter((g) => g.awayId !== null && !isPlayed(g)).map((g) => g.week);
  return open.length ? Math.min(...open) : Math.max(...games.map((g) => g.week));
}

/** deps: store. */
function createPublic({ store }) {
  async function get(slug) {
    if (typeof slug !== "string" || !SLUG.test(slug)) return fail(404, NOT_FOUND); // nothing malformed reaches Firestore
    const league = await store.getLeagueBySlug(slug);
    if (!league) return fail(404, NOT_FOUND);
    const [entrants, schedule] = await Promise.all([store.listEntrants(league.id), store.getSchedule(league.id)]);
    entrants.sort((a, b) => a.position - b.position);
    const games = schedule ? schedule.games : [];
    const names = namesOf(entrants);
    const { id: _private, ...publicLeague } = leagueJson(league); // the id stays private; organizerId is not in leagueJson
    return [200, {
      league: publicLeague,
      current_week: currentWeek(games),
      games: games.map((g, i) => gameJson(league.id, schedule.generation, g, i, names)),
      standings: standingsJson(computeStandings(entrants, games), playedCount(games)),
    }];
  }
  return { get };
}

module.exports = { currentWeek, createPublic };
