// The schedule: the round robin itself, and the routes that generate it, list games and clear scores.
// All storage goes through `store`. The schedule is one document per league: {generation, games: [...]}.
const crypto = require("node:crypto");
const { fail } = require("./http");

/**
 * Circle method: one list of [home, away] pairs per week; away is null for the bye.
 *
 * Ring of n slots (n even). With an odd count the bye placeholder null takes slot 0, so it is the fixed
 * slot and the real entrants rotate. Slot 0 never moves; each week the entrant in the last slot moves to
 * slot 1 and the others shift up one (ring = [ring[0], ring[-1], *ring[1:-1]]). Slot i meets slot n-1-i.
 * A pair holding the placeholder is a bye, written [real id, null]: real id at home. This bye swap is
 * applied after the parity flip below.
 *
 * Orientation, so every entrant's home and away games differ by at most one (byes don't count): number
 * the pairs of a week 0, 1, 2, ... by slot i. Pair 0 is (slot 0, slot n-1) in even weeks (counting weeks
 * from 0) and flipped to (slot n-1, slot 0) in odd weeks. Every other pair i is (slot i, slot n-1-i) when
 * i is odd and flipped when i is even, in every week. Checked by test/schedule.test.js for n = 2..52.
 * (A port of round_robin in backends/fastapi/app/schedule.py; test/fixtures/round_robin_fastapi.json pins it.)
 */
function roundRobin(entrantIds) {
  let ring = [...entrantIds];
  if (ring.length % 2) ring.unshift(null);
  const n = ring.length;
  const weeks = [];
  for (let w = 0; w < n - 1; w++) {
    const week = [];
    for (let i = 0; i < n / 2; i++) {
      let a = ring[i];
      let b = ring[n - 1 - i];
      if (i === 0 ? w % 2 === 1 : i % 2 === 0) [a, b] = [b, a];
      if (a === null) [a, b] = [b, a];
      week.push([a, b]);
    }
    weeks.push(week);
    ring = [ring[0], ring[n - 1], ...ring.slice(1, n - 1)];
  }
  return weeks;
}

/** A stored game as the contract's Game; `index` is its position in the schedule, which is its id's last part. */
const gameJson = (leagueId, generation, g, index, names) => ({
  id: `${leagueId}.${generation}.${index}`,
  week: g.week,
  home_id: g.homeId,
  home_name: names.get(g.homeId),
  away_id: g.awayId,
  away_name: g.awayId === null ? null : names.get(g.awayId),
  home_score: g.homeScore,
  away_score: g.awayScore,
});

const namesOf = (entrants) => new Map(entrants.map((e) => [e.id, e.name]));

/** deps: store, leagues (ownedLeague), newGeneration (injectable for tests). */
function createSchedule(deps) {
  const { store, leagues } = deps;
  const newGeneration = deps.newGeneration ?? (() => crypto.randomBytes(4).toString("hex"));

  async function generate(organizer, id) {
    await leagues.ownedLeague(id, organizer);
    // The store reads entrants, schedule and league, calls this, and writes both results in one transaction.
    const { weeks, message } = await store.generateSchedule(id, ({ league, entrants, schedule }) => {
      if (entrants.length < 2) fail(400, "Add at least 2 entrants first");
      if (schedule && schedule.games.some((g) => g.homeScore !== null)) fail(409, "Scores already recorded — clear them first");
      const rounds = roundRobin(entrants.sort((a, b) => a.position - b.position).map((e) => e.id));
      const games = rounds.flatMap((pairs, w) =>
        pairs.map(([homeId, awayId], slot) => ({ week: w + 1, slot, homeId, awayId, homeScore: null, awayScore: null })));
      const n = rounds.length;
      const unit = n === 1 ? "week" : "weeks";
      const message = league.weeks === n ? null : `This schedule needs ${n} ${unit}, so the league now runs ${n} ${unit} instead of ${league.weeks}.`;
      return { schedule: { generation: newGeneration(), games }, weeks: n, message };
    });
    return [201, { weeks, message }];
  }

  async function listGames(organizer, id) {
    await leagues.ownedLeague(id, organizer);
    const [schedule, entrants] = await Promise.all([store.getSchedule(id), store.listEntrants(id)]);
    if (!schedule) return [200, []];
    const names = namesOf(entrants);
    return [200, schedule.games.map((g, i) => gameJson(id, schedule.generation, g, i, names))];
  }

  async function clearScores(organizer, id) {
    await leagues.ownedLeague(id, organizer);
    const cleared = await store.updateSchedule(id, (schedule) => {
      if (!schedule) return { schedule: null, result: 0 };
      const cleared = schedule.games.filter((g) => g.homeScore !== null).length; // as FastAPI counts: a stored score
      const games = schedule.games.map((g) => ({ ...g, homeScore: null, awayScore: null }));
      return { schedule: { ...schedule, games }, result: cleared };
    });
    return [200, { cleared }];
  }

  return { generate, listGames, clearScores };
}

module.exports = { roundRobin, gameJson, namesOf, createSchedule };
