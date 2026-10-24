import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1'
import { ApiError } from './http.ts'
import { checkNewEntrant, entrantName, leagueJson, newLeague, ownedLeague } from './leagues.ts'

const throwsApi = (fn: () => unknown, status: number, message: string) => {
  const e = assertThrows(fn, ApiError, message) as ApiError
  assertEquals([e.status, e.message], [status, message])
}
const base = { name: 'Cornhole', location: 'Bar', weeks: 3 }

Deno.test('newLeague trims, defaults sport/season to "" and allow_ties to false', () => {
  assertEquals(newLeague({ ...base, name: '  Pitch  ', location: ' Bar ' }), {
    name: 'Pitch', location: 'Bar', sport: '', season: '', weeks: 3, allow_ties: false,
  })
  assertEquals(newLeague({ ...base, sport: '  Darts ', season: '   ', allow_ties: true }), {
    name: 'Cornhole', location: 'Bar', sport: 'Darts', season: '', weeks: 3, allow_ties: true,
  })
  assertEquals(newLeague({ ...base, sport: 5, season: null }).sport, '')
})

Deno.test('newLeague: blank or non-string name is Name is required', () => {
  for (const name of ['', '  ', null, 5, undefined]) throwsApi(() => newLeague({ ...base, name }), 400, 'Name is required')
})

Deno.test('newLeague: name of 100 code points kept (after trimming), 101 refused', () => {
  assertEquals(newLeague({ ...base, name: '  ' + 'a'.repeat(100) + '  ' }).name.length, 100)
  assertEquals([...newLeague({ ...base, name: '😀'.repeat(100) }).name].length, 100)
  throwsApi(() => newLeague({ ...base, name: 'a'.repeat(101) }), 400, 'Name must be 100 characters or fewer')
  throwsApi(() => newLeague({ ...base, name: '😀'.repeat(101) }), 400, 'Name must be 100 characters or fewer')
})

Deno.test('newLeague: blank or non-string location is Location is required', () => {
  for (const location of ['', '   ', null, 5]) throwsApi(() => newLeague({ ...base, location }), 400, 'Location is required')
})

Deno.test('newLeague: weeks must be a JSON integer >= 1 (booleans and strings refused)', () => {
  for (const weeks of [0, -1, 'eight', '8', 2.5, true, false, null, undefined]) {
    throwsApi(() => newLeague({ ...base, weeks }), 400, 'Weeks must be at least 1')
  }
  // JSON.parse('3.0') is 3, so JS can't tell them apart; the contract rules that an integral number counts
  // (FastAPI and Django accept 3.0 too, as they do for scores)
  assertEquals(newLeague(JSON.parse('{"name":"A","location":"B","weeks":3.0}')).weeks, 3)
})

Deno.test('newLeague: weeks above 52 is refused; 52 is kept', () => {
  for (const weeks of [53, 2 ** 31, 3_000_000_000, 1e20]) {
    throwsApi(() => newLeague({ ...base, weeks }), 400, 'Weeks must be between 1 and 52')
  }
  assertEquals(newLeague({ ...base, weeks: 52 }).weeks, 52)
})

Deno.test('newLeague: allow_ties must be a boolean when present', () => {
  for (const allow_ties of ['yes', 1, null, 'true']) throwsApi(() => newLeague({ ...base, allow_ties }), 400, 'Invalid request')
})

Deno.test('newLeague checks name, name length, location, weeks, then allow_ties, in that order', () => {
  throwsApi(() => newLeague({ name: '', location: '', weeks: 0, allow_ties: 'x' }), 400, 'Name is required')
  throwsApi(() => newLeague({ name: 'a'.repeat(101), location: '', weeks: 0 }), 400, 'Name must be 100 characters or fewer')
  throwsApi(() => newLeague({ name: 'A', location: '', weeks: 99 }), 400, 'Location is required')
  throwsApi(() => newLeague({ name: 'A', location: 'B', weeks: 0, allow_ties: 'x' }), 400, 'Weeks must be at least 1')
  throwsApi(() => newLeague({ name: 'A', location: 'B', weeks: 99, allow_ties: 'x' }), 400, 'Weeks must be between 1 and 52')
})

Deno.test('leagueJson is the contract\'s League shape, nothing more', () => {
  const row = {
    id: 'abc', slug: 'xyz234', name: 'N', location: 'L', sport: '', season: 'S', weeks: 3, allow_ties: true,
    organizer_id: 'u', created_at: 't',
  }
  assertEquals(leagueJson(row), {
    id: 'abc', slug: 'xyz234', name: 'N', location: 'L', sport: '', season: 'S', weeks: 3, allow_ties: true,
  })
})

Deno.test('entrantName trims; blank or non-string is Name is required; 101 code points refused', () => {
  assertEquals(entrantName('  Corn Stars '), 'Corn Stars')
  for (const bad of ['', '   ', null, 5, true, ['x'], undefined]) throwsApi(() => entrantName(bad), 400, 'Name is required')
  assertEquals(entrantName('a'.repeat(100)).length, 100)
  assertEquals(entrantName('  ' + 'c'.repeat(100) + '  ').length, 100)
  throwsApi(() => entrantName('b'.repeat(101)), 400, 'Name must be 100 characters or fewer')
})

const DUP = 'An entrant with that name already exists in this league'
Deno.test('checkNewEntrant: duplicates compared trimmed and plain lower-cased', () => {
  for (const again of ['Bag Ladies', 'bag ladies', 'BAG LADIES']) throwsApi(() => checkNewEntrant(again, ['Bag Ladies']), 409, DUP)
  // toLowerCase, not case folding: "STRASSE" is not "Straße"
  checkNewEntrant('STRASSE', ['Straße'])
  checkNewEntrant('Corn', [' Bag Ladies '])
  throwsApi(() => checkNewEntrant('bag ladies', [' Bag Ladies ']), 409, DUP)
})

Deno.test('checkNewEntrant: the 53rd is refused, after the duplicate check', () => {
  const full = Array.from({ length: 52 }, (_, i) => `Team ${i}`)
  checkNewEntrant('Team 52', full.slice(0, 51))
  throwsApi(() => checkNewEntrant('One too many', full), 400, 'A league can have at most 52 entrants')
  throwsApi(() => checkNewEntrant('team 3', full), 409, DUP)
})

// A stand-in for the supabase-js query chain .from().select().eq().maybeSingle()
const fakeClient = (reply: { data: unknown; error: unknown }) => {
  const seen: unknown[] = []
  const chain = {
    select: (cols: string) => (seen.push(['select', cols]), chain),
    eq: (col: string, v: unknown) => (seen.push(['eq', col, v]), chain),
    maybeSingle: () => Promise.resolve(reply),
  }
  return { seen, client: { from: (t: string) => (seen.push(['from', t]), chain) } }
}

Deno.test('ownedLeague returns the row RLS lets through, filtered by id', async () => {
  const row = { id: 'abc', name: 'N' }
  const { seen, client } = fakeClient({ data: row, error: null })
  assertEquals(await ownedLeague(client as never, 'abc'), row as never)
  assertEquals(seen[0], ['from', 'leagues'])
  assertEquals(seen.some((s) => JSON.stringify(s) === JSON.stringify(['eq', 'id', 'abc'])), true)
})

Deno.test('ownedLeague: no row (unknown, or another organizer\'s) is 404 League not found', async () => {
  const { client } = fakeClient({ data: null, error: null })
  const e = await assertRejects(() => ownedLeague(client as never, 'nope'), ApiError, 'League not found')
  assertEquals((e as ApiError).status, 404)
})

Deno.test('ownedLeague: a bad-input PostgREST error (class 22, e.g. a NUL in the id) is 404, never its body', async () => {
  const { client } = fakeClient({ data: null, error: { code: '22P05', message: 'unsupported Unicode escape' } })
  const e = await assertRejects(() => ownedLeague(client as never, 'a\u0000b'), ApiError, 'League not found')
  assertEquals((e as ApiError).status, 404)
})

Deno.test('ownedLeague: any other PostgREST error is the generic 500, its body kept in the log', async () => {
  const orig = console.error
  console.error = () => {}
  try {
    const { client } = fakeClient({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })
    const e = await assertRejects(() => ownedLeague(client as never, 'abc'), ApiError, 'The backend had a problem')
    assertEquals((e as ApiError).status, 500)
  } finally {
    console.error = orig
  }
})
