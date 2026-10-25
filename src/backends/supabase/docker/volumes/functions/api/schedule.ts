// US04: the round-robin schedule, ported from backends/fastapi/app/schedule.py. The same ordered ids must
// give the same schedule (fixtures/round_robin_fastapi.json is FastAPI's own output).

export type Pair = [string, string | null]

/**
 * Circle method: one list of (home, away) pairs per week; away is null for the bye.
 *
 * Ring of n slots (n even). With an odd count the bye placeholder null takes slot 0, so it is the fixed
 * slot and the real entrants rotate. Slot 0 never moves; each week the entrant in the last slot moves to
 * slot 1 and the others shift up one (ring = [ring[0], ring[-1], ...ring[1:-1]]). Slot i meets slot n-1-i.
 * A pair holding the placeholder is a bye, written (real id, null): real id at home. This bye swap is
 * applied after the parity flip below.
 *
 * Orientation, so every entrant's home and away games differ by at most one (byes don't count): number
 * the pairs of a week 0, 1, 2, ... by slot i. Pair 0 is (slot 0, slot n-1) in even weeks (counting weeks
 * from 0) and flipped to (slot n-1, slot 0) in odd weeks. Every other pair i is (slot i, slot n-1-i) when
 * i is odd and flipped when i is even, in every week. Checked by schedule_test.ts for n = 2..52.
 */
export function roundRobin(entrantIds: string[]): Pair[][] {
  let ring: (string | null)[] = [...entrantIds]
  if (ring.length % 2) ring.unshift(null)
  const n = ring.length
  const weeks: Pair[][] = []
  for (let w = 0; w < n - 1; w++) {
    const week: Pair[] = []
    for (let i = 0; i < n / 2; i++) {
      let a = ring[i]
      let b = ring[n - 1 - i]
      if (i === 0 ? w % 2 === 1 : i % 2 === 0) [a, b] = [b, a]
      if (a === null) [a, b] = [b, a]
      week.push([a as string, b])
    }
    weeks.push(week)
    ring = [ring[0], ring[n - 1], ...ring.slice(1, n - 1)]
  }
  return weeks
}

/** The note shown when generating changed the league's weeks; null when they already matched. */
export function weeksMessage(needed: number, old: number): string | null {
  if (needed === old) return null
  const unit = needed === 1 ? 'week' : 'weeks'
  return `This schedule needs ${needed} ${unit}, so the league now runs ${needed} ${unit} instead of ${old}.`
}

export type GameRecord = {
  id: string
  week: number
  home_id: string
  away_id: string | null
  home_score: number | null
  away_score: number | null
}

export const gameJson = (g: GameRecord, names: Map<string, string>) => ({
  id: g.id,
  week: g.week,
  home_id: g.home_id,
  home_name: names.get(g.home_id) ?? null,
  away_id: g.away_id,
  away_name: g.away_id ? (names.get(g.away_id) ?? null) : null,
  home_score: g.home_score,
  away_score: g.away_score,
})
