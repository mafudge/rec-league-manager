import { assertEquals } from 'jsr:@std/assert@1'
import { currentWeek } from './public.ts'

const g = (week: number, away_id: string | null, home_score: number | null, away_score: number | null) =>
  ({ week, home_id: 'a', away_id, home_score, away_score })

Deno.test('current_week is null with no games', () => assertEquals(currentWeek([]), null))

Deno.test('current_week is the lowest week with an unplayed non-bye game', () => {
  assertEquals(currentWeek([g(1, 'b', null, null), g(2, 'b', null, null)]), 1)
  assertEquals(currentWeek([g(1, 'b', 21, 14), g(2, 'b', null, null), g(3, 'b', null, null)]), 2)
  assertEquals(currentWeek([g(1, 'b', 21, 14), g(1, 'c', null, null), g(2, 'b', null, null)]), 1)
})

Deno.test('a bye does not hold a week open', () => {
  assertEquals(currentWeek([g(1, 'b', 3, 2), g(1, null, null, null), g(2, 'b', null, null)]), 2)
})

Deno.test('with every non-bye game played it is the last week', () => {
  assertEquals(currentWeek([g(1, 'b', 3, 2), g(2, 'b', 1, 0), g(2, null, null, null)]), 2)
})
