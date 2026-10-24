// US06: standings are computed from the games on every request, never stored (PRD G2). A port of
// backends/fastapi/app/standings.py. Entrants are {id, name}; games are the stored shape
// {week, homeId, awayId (null is a bye), homeScore, awayScore (both null until played)}.

/** A played game is a non-bye game with both scores. */
const isPlayed = (g) => g.awayId !== null && g.homeScore !== null && g.awayScore !== null;

const playedCount = (games) => games.filter(isPlayed).length;

const TIEBREAK = "Sorted by wins, then point difference, then points for.";

function computeStandings(entrants, games) {
  const rows = new Map(entrants.map((e) => [e.id, { entrantId: e.id, name: e.name, w: 0, l: 0, t: 0, pf: 0, pa: 0 }]));
  // Bad game data is an error whether or not the game was played, so the result never depends on a score.
  for (const g of games) {
    for (const id of [g.homeId, g.awayId]) {
      if (id !== null && !rows.has(id)) throw new Error(`Week ${g.week}: entrant ${id} is not in this league`);
    }
    if (g.awayId === g.homeId) throw new Error(`Week ${g.week}: entrant ${g.homeId} (${rows.get(g.homeId).name}) can't play itself`);
  }
  for (const g of games) {
    if (!isPlayed(g)) continue; // byes and unplayed games contribute nothing (US06 AC4)
    const home = rows.get(g.homeId);
    const away = rows.get(g.awayId);
    home.pf += g.homeScore; home.pa += g.awayScore;
    away.pf += g.awayScore; away.pa += g.homeScore;
    if (g.homeScore > g.awayScore) { home.w++; away.l++; }
    else if (g.awayScore > g.homeScore) { away.w++; home.l++; }
    else { home.t++; away.t++; } // a tie gives neither side a W or L
  }
  const out = [...rows.values()].map((r) => ({ ...r, diff: r.pf - r.pa }));
  // W, then Diff, then PF, all descending; name only makes the order deterministic (code point order, as Python's).
  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return out.sort((a, b) => b.w - a.w || b.diff - a.diff || b.pf - a.pf || byName([...a.name], [...b.name]));
}

const standingsJson = (rows, played) => ({
  rows: rows.map((r) => ({ entrant_id: r.entrantId, name: r.name, w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa, diff: r.diff })),
  played,
  tiebreak: TIEBREAK,
});

/** deps: store, leagues (ownedLeague). */
function createStandings({ store, leagues }) {
  async function get(organizer, id) {
    await leagues.ownedLeague(id, organizer);
    const [entrants, schedule] = await Promise.all([store.listEntrants(id), store.getSchedule(id)]);
    entrants.sort((a, b) => a.position - b.position);
    const games = schedule ? schedule.games : [];
    return [200, standingsJson(computeStandings(entrants, games), playedCount(games))];
  }
  return { get };
}

module.exports = { isPlayed, playedCount, computeStandings, standingsJson, createStandings, TIEBREAK };
