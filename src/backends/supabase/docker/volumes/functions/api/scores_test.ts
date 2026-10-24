import { assertEquals } from 'jsr:@std/assert@1'
import { ApiError } from './http.ts'
import { scoreChange } from './scores.ts'

const WHOLE = 'Scores must be whole numbers 0 or greater'
const refusal = (body: Record<string, unknown>, ties = false) => {
  try {
    scoreChange(body, ties)
  } catch (e) {
    if (e instanceof ApiError) return [e.status, e.message]
    throw e
  }
  return null
}

Deno.test('whole scores are kept; 21.0 parses to 21', () => {
  assertEquals(scoreChange(JSON.parse('{"home_score": 21.0, "away_score": 14}'), false), { home: 21, away: 14 })
  assertEquals(scoreChange({ home_score: 0, away_score: 2 ** 31 - 1 }, false), { home: 0, away: 2 ** 31 - 1 })
})

Deno.test('both null or both absent clears', () => {
  assertEquals(scoreChange({}, false), 'clear')
  assertEquals(scoreChange({ home_score: null, away_score: null }, false), 'clear')
  assertEquals(scoreChange({ home_score: null }, false), 'clear')
})

Deno.test('not whole numbers 0 or greater: refused', () => {
  const bad: Record<string, unknown>[] = [
    { home_score: -1, away_score: 14 },
    { home_score: null, away_score: 14 },
    { away_score: 14 },
    { home_score: 21, away_score: null },
    { home_score: 21.5, away_score: 14 },
    { home_score: 21, away_score: 14.5 },
    { home_score: '21', away_score: 14 },
    { home_score: true, away_score: 14 },
    { home_score: 21, away_score: false },
    { home_score: 1e30, away_score: 14 },
    { home_score: 21, away_score: 2 ** 31 },
    { home_score: [], away_score: 1 },
    { home_score: {}, away_score: 1 },
  ]
  for (const b of bad) assertEquals(refusal(b), [400, WHOLE], JSON.stringify(b))
})

Deno.test('ties: refused unless the league allows them; whole-number check comes first', () => {
  assertEquals(refusal({ home_score: 5, away_score: 5 }), [400, "This league doesn't allow ties"])
  assertEquals(refusal({ home_score: 5, away_score: 5 }, true), null)
  assertEquals(refusal({ home_score: -5, away_score: -5 }), [400, WHOLE])
})
