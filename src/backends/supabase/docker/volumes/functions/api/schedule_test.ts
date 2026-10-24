import { assertEquals } from 'jsr:@std/assert@1'
import { roundRobin, weeksMessage } from './schedule.ts'
import fixture from './fixtures/round_robin_fastapi.json' with { type: 'json' }

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${String(i).padStart(2, '0')}`)

Deno.test('round_robin equals FastAPI\'s for every n in the shared fixture (same pairs, order, home/away, byes)', () => {
  const ns = Object.keys(fixture)
  assertEquals(ns, ['2', '3', '5', '6', '7', '52'])
  for (const n of ns) assertEquals(roundRobin(ids(Number(n))), (fixture as Record<string, unknown>)[n], `n=${n}`)
})

Deno.test('two ids make one game', () => assertEquals(roundRobin(['a', 'b']), [[['a', 'b']]]))

Deno.test('every pair once, one bye per week for odd n, home and away differ by at most one, n = 2..52', () => {
  for (let n = 2; n <= 52; n++) {
    const everyone = ids(n)
    const home = new Map(everyone.map((e) => [e, 0]))
    const away = new Map(everyone.map((e) => [e, 0]))
    const seen: string[] = []
    const rounds = roundRobin(everyone)
    assertEquals(rounds.length, n % 2 ? n : n - 1)
    for (const week of rounds) {
      const byes = week.filter(([, a]) => a === null)
      assertEquals(byes.length, n % 2 ? 1 : 0, `n=${n}`)
      for (const [h, a] of week) {
        if (a === null) continue
        home.set(h, home.get(h)! + 1)
        away.set(a, away.get(a)! + 1)
        seen.push([h, a].sort().join('|'))
      }
    }
    assertEquals(new Set(seen).size, (n * (n - 1)) / 2, `n=${n}`)
    assertEquals(seen.length, (n * (n - 1)) / 2, `n=${n}`)
    for (const e of everyone) if (Math.abs(home.get(e)! - away.get(e)!) > 1) throw new Error(`unbalanced n=${n} ${e}`)
  }
})

Deno.test('the weeks message: null when unchanged, week/weeks singular and plural', () => {
  assertEquals(weeksMessage(5, 5), null)
  assertEquals(weeksMessage(5, 8), 'This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8.')
  assertEquals(weeksMessage(1, 8), 'This schedule needs 1 week, so the league now runs 1 week instead of 8.')
})
