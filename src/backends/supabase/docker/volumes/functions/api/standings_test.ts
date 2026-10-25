import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { computeStandings, type Entrant, type Game, isPlayed, playedCount, standingsJson, TIEBREAK } from './standings.ts'

const A: Entrant = { id: '1', name: 'Bag Ladies' }
const B: Entrant = { id: '2', name: 'Corn Stars' }
const C: Entrant = { id: '3', name: 'Hole Patrol' }
const D: Entrant = { id: '4', name: 'Sack Attack' }
const game = (week: number, home_id: string, away_id: string | null, home_score: number | null, away_score: number | null): Game =>
  ({ week, home_id, away_id, home_score, away_score })
const table = (rows: ReturnType<typeof computeStandings>) => rows.map((r) => [r.name, r.w, r.l, r.pf, r.pa, r.diff])

Deno.test('played games give w, l, pf, pa, diff sorted by w then diff', () => {
  const games = [game(1, '1', '2', 21, 14), game(1, '3', '4', 21, 20), game(2, '1', '3', 21, 10), game(2, '2', '4', 21, 5)]
  assertEquals(table(computeStandings([A, B, C, D], games)), [
    ['Bag Ladies', 2, 0, 42, 24, 18],
    ['Corn Stars', 1, 1, 35, 26, 9],
    ['Hole Patrol', 1, 1, 31, 41, -10],
    ['Sack Attack', 0, 2, 25, 42, -17],
  ])
})

Deno.test('equal w and diff are ordered by pf', () => {
  const games = [game(1, '2', '1', 15, 10), game(2, '2', '4', 5, 10), game(1, '3', '4', 21, 16), game(2, '3', '1', 16, 21)]
  const rows = computeStandings([A, B, C, D], games)
  assertEquals(rows.every((r) => r.w === 1 && r.diff === 0), true)
  assertEquals(rows.map((r) => [r.name, r.pf]), [['Hole Patrol', 37], ['Bag Ladies', 31], ['Sack Attack', 26], ['Corn Stars', 20]])
})

Deno.test('name makes a full tie deterministic', () => {
  assertEquals(computeStandings([B, A], []).map((r) => r.name), ['Bag Ladies', 'Corn Stars'])
})

Deno.test('no games played: every entrant listed with zeros', () => {
  const rows = computeStandings([A, B, C, D], [game(1, '1', '2', null, null), game(1, '3', '4', null, null)])
  assertEquals(rows.map((r) => [r.w, r.l, r.t, r.pf, r.pa, r.diff]), Array(4).fill([0, 0, 0, 0, 0, 0]))
  assertEquals(computeStandings([A, B, C, D], []).length, 4)
})

Deno.test('an unplayed or half-scored game contributes nothing', () => {
  const played = [game(1, '1', '2', 21, 14)]
  const unplayed = [game(2, '1', '3', null, null), game(2, '2', '4', 21, null)]
  assertEquals(computeStandings([A, B, C, D], [...played, ...unplayed]), computeStandings([A, B, C, D], played))
})

Deno.test('a bye contributes nothing', () => {
  assertEquals(table(computeStandings([A, B], [game(1, '1', null, null, null)])), [
    ['Bag Ladies', 0, 0, 0, 0, 0], ['Corn Stars', 0, 0, 0, 0, 0],
  ])
})

Deno.test('a tie counts points and a t for each side, neither a win nor a loss', () => {
  const rows = computeStandings([A, B], [game(1, '1', '2', 15, 15)])
  assertEquals(table(rows), [['Bag Ladies', 0, 0, 15, 15, 0], ['Corn Stars', 0, 0, 15, 15, 0]])
  assertEquals(rows.map((r) => r.t), [1, 1])
})

Deno.test('US06-01: an unknown entrant is an error, played or not', () => {
  assertThrows(() => computeStandings([A, B], [game(3, '1', '99', 10, 5)]), Error, 'Week 3: entrant 99 is not in this league')
  assertThrows(() => computeStandings([A, B], [game(2, '77', '2', null, null)]), Error, 'Week 2: entrant 77 is not in this league')
})

Deno.test("US06-01: an entrant can't play itself", () => {
  assertThrows(() => computeStandings([A, B], [game(3, '2', '2', 10, 5)]), Error, "Week 3: entrant 2 (Corn Stars) can't play itself")
})

Deno.test('standingsJson is the contract shape with the exact tiebreak sentence', () => {
  assertEquals(TIEBREAK, 'Sorted by wins, then point difference, then points for.')
  assertEquals(standingsJson(computeStandings([A], []), 0), {
    rows: [{ entrant_id: '1', name: 'Bag Ladies', w: 0, l: 0, t: 0, pf: 0, pa: 0, diff: 0 }],
    played: 0,
    tiebreak: TIEBREAK,
  })
})

Deno.test('is_played and played_count ignore byes and half-scored games', () => {
  const g = (away_id: string | null, home_score: number | null, away_score: number | null) =>
    ({ home_id: 'a', away_id, home_score, away_score })
  assertEquals(isPlayed(g('b', 1, 0)), true)
  assertEquals(isPlayed(g('b', 0, 0)), true)
  assertEquals(isPlayed(g(null, 1, 0)), false)
  assertEquals(isPlayed(g('b', null, null)), false)
  assertEquals(isPlayed(g('b', 1, null)), false)
  assertEquals(playedCount([g('b', 1, 0), g(null, null, null), g('b', null, null)]), 1)
})
