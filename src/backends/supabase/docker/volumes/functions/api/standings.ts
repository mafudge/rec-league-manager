// Standings are computed from games on every request, never stored (PRD G2). Task 4 adds computeStandings;
// isPlayed and playedCount come first because the schedule and score routes need them.

export type GameRow = {
  home_id: string
  away_id: string | null // null is a bye
  home_score: number | null // both null until played
  away_score: number | null
}

/** A played game is a non-bye game with both scores. */
export const isPlayed = (g: GameRow): boolean =>
  g.away_id !== null && g.home_score !== null && g.away_score !== null

export const playedCount = (games: GameRow[]): number => games.filter(isPlayed).length
