// US06: standings are computed from games on every request, never stored (PRD G2). Ported from FastAPI's
// standings.py: same sort, same tiebreak sentence, same US06-01 errors for bad game data.

export type Entrant = { id: string; name: string }

export type GameRow = {
  home_id: string
  away_id: string | null // null is a bye
  home_score: number | null // both null until played
  away_score: number | null
}

export type Game = GameRow & { week: number }

export type StandingsRow = {
  entrant_id: string
  name: string
  w: number
  l: number
  t: number
  pf: number
  pa: number
  diff: number
}

/** A played game is a non-bye game with both scores. */
export const isPlayed = (g: GameRow): boolean =>
  g.away_id !== null && g.home_score !== null && g.away_score !== null

export const playedCount = (games: GameRow[]): number => games.filter(isPlayed).length

export function computeStandings(entrants: Entrant[], games: Game[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(
    entrants.map((e) => [e.id, { entrant_id: e.id, name: e.name, w: 0, l: 0, t: 0, pf: 0, pa: 0, diff: 0 }]),
  )
  // Bad game data is an error whether or not the game was played, so the result never depends on a score.
  for (const g of games) {
    for (const id of [g.home_id, g.away_id]) {
      if (id !== null && !rows.has(id)) throw new Error(`Week ${g.week}: entrant ${id} is not in this league`)
    }
    if (g.away_id === g.home_id) {
      throw new Error(`Week ${g.week}: entrant ${g.home_id} (${rows.get(g.home_id)!.name}) can't play itself`)
    }
  }
  for (const g of games) {
    // Byes and unplayed games contribute nothing (US06 AC4).
    if (!isPlayed(g)) continue
    const home = rows.get(g.home_id)!
    const away = rows.get(g.away_id!)!
    const [hs, as] = [g.home_score!, g.away_score!]
    home.pf += hs
    home.pa += as
    away.pf += as
    away.pa += hs
    // A tie gives neither side a W or L; each side gets a T.
    if (hs > as) {
      home.w++
      away.l++
    } else if (as > hs) {
      away.w++
      home.l++
    } else {
      home.t++
      away.t++
    }
  }
  for (const r of rows.values()) r.diff = r.pf - r.pa
  // W, then Diff, then PF, all descending; name only makes the order deterministic (code point order, like Python).
  return [...rows.values()].sort((a, b) =>
    b.w - a.w || b.diff - a.diff || b.pf - a.pf || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export const TIEBREAK = 'Sorted by wins, then point difference, then points for.'

/** The Standings shape of the contract; `played` is the number of non-bye games with a score. */
export const standingsJson = (rows: StandingsRow[], played: number) => ({ rows, played, tiebreak: TIEBREAK })
