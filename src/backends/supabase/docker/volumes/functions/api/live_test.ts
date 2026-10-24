// Row-level security, proved against the running stack (Review Focus 2).
// Skipped unless LIVE_SUPABASE=1; run with `LIVE_SUPABASE=1 ./test.sh` (it passes the anon key and host network).
// Two organizers: B's own token, sent straight to PostgREST, sees none of A's rows and can change none of them,
// and the function answers 404 for A's league. A's token sees the same rows, so the zeros aren't vacuous.
import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1'

const live = Deno.env.get('LIVE_SUPABASE') === '1'
const BASE = Deno.env.get('SUPABASE_BASE') ?? 'http://localhost:54321'
const API = `${BASE}/functions/v1`
const REST = `${BASE}/rest/v1`
const ANON = Deno.env.get('ANON_KEY') ?? ''

async function call(method: string, url: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, body: json as any }
}
const api = (method: string, path: string, token?: string, body?: unknown) =>
  call(method, `${API}${path}`, token ? { Authorization: `Bearer ${token}` } : {}, body)
const rest = (method: string, path: string, token: string, body?: unknown, extra: Record<string, string> = {}) =>
  call(method, `${REST}${path}`, { apikey: ANON, Authorization: `Bearer ${token}`, ...extra }, body)

async function organizer(tag: string) {
  const email = `rls-${tag}-${crypto.randomUUID().slice(0, 8)}@example.com`
  const r = await api('POST', '/api/auth/signup', undefined, { email, password: 'cornhole1' })
  assertEquals(r.status, 201, JSON.stringify(r.body))
  const sub = JSON.parse(atob(r.body.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub as string
  return { token: r.body.token as string, id: sub }
}

Deno.test({
  name: 'RLS: organizer B cannot read or write organizer A\'s league, entrants or games',
  ignore: !live,
  fn: async () => {
    if (!ANON) throw new Error('ANON_KEY is not set')
    const a = await organizer('a')
    const b = await organizer('b')

    const made = await api('POST', '/api/leagues', a.token, { name: 'A League', location: 'Bar', weeks: 3 })
    assertEquals(made.status, 201, JSON.stringify(made.body))
    const id = made.body.id as string
    assertEquals((await api('POST', `/api/leagues/${id}/entrants`, a.token, { name: 'Bag Ladies' })).status, 201)
    assertEquals((await api('POST', `/api/leagues/${id}/entrants`, a.token, { name: 'Corn Stars' })).status, 201)

    // Control: A's own token, straight to PostgREST, sees the league and both entrants.
    assertEquals((await rest('GET', `/leagues?id=eq.${id}&select=id`, a.token)).body, [{ id }])
    assertEquals((await rest('GET', `/entrants?league_id=eq.${id}&select=name&order=position`, a.token)).body,
      [{ name: 'Bag Ladies' }, { name: 'Corn Stars' }])

    // B, straight to PostgREST: zero rows, by id and in a full listing.
    const byId = await rest('GET', `/leagues?id=eq.${id}`, b.token)
    assertEquals([byId.status, byId.body], [200, []])
    assertEquals((await rest('GET', '/leagues', b.token)).body, [])
    assertEquals((await rest('GET', `/entrants?league_id=eq.${id}`, b.token)).body, [])
    assertEquals((await rest('GET', `/games?league_id=eq.${id}`, b.token)).body, [])

    // B cannot change A's league or add to it, even naming A as the owner.
    const patched = await rest('PATCH', `/leagues?id=eq.${id}`, b.token, { name: 'Hijacked' }, { Prefer: 'return=representation' })
    assertEquals(patched.body, [])
    const removed = await rest('DELETE', `/entrants?league_id=eq.${id}`, b.token, undefined, { Prefer: 'return=representation' })
    assertEquals(removed.body, [])
    const intruder = await rest('POST', '/entrants', b.token, { league_id: id, name: 'Intruders', position: 9 })
    assertNotEquals(intruder.status, 201, JSON.stringify(intruder.body))
    const forged = await rest('POST', '/leagues', b.token, {
      organizer_id: a.id, slug: 'zzzzzz', name: 'Forged', location: 'X', weeks: 1,
    })
    assertNotEquals(forged.status, 201, JSON.stringify(forged.body))
    assertEquals((await rest('GET', `/leagues?id=eq.${id}&select=name`, a.token)).body, [{ name: 'A League' }])
    assertEquals((await rest('GET', `/entrants?league_id=eq.${id}&select=name`, a.token)).body.length, 2)

    // The anonymous role (the anon key alone) reads nothing at all.
    const anon = await call('GET', `${REST}/leagues?id=eq.${id}`, { apikey: ANON, Authorization: `Bearer ${ANON}` })
    assertEquals(anon.status === 200 ? anon.body : [], [])

    // And the function: B gets 404 League not found for every route on A's league, and an empty list.
    for (const [method, path, body] of [
      ['GET', `/api/leagues/${id}`, undefined],
      ['GET', `/api/leagues/${id}/entrants`, undefined],
      ['POST', `/api/leagues/${id}/entrants`, { name: 'Intruders' }],
    ] as const) {
      const r = await api(method, path, b.token, body)
      assertEquals([r.status, r.body], [404, { error: 'League not found' }], `${method} ${path}`)
    }
    assertEquals((await api('GET', '/api/leagues', b.token)).body, [])
    assertEquals((await api('GET', `/api/leagues/${id}/entrants`, a.token)).body.map((e: any) => e.name), ['Bag Ladies', 'Corn Stars'])
  },
})

Deno.test({
  name: 'the function: odd ids are 404 League not found, never a 500 or a PostgREST body',
  ignore: !live,
  fn: async () => {
    const a = await organizer('ids')
    // (%00 never reaches the function: the gateway, Envoy, refuses it with an empty 400 of its own)
    for (const id of ['nope', '%zz', 'a,b', 'eq.x', '(x)', "'%3B--", '%F0%9F%98%80']) {
      const r = await api('GET', `/api/leagues/${id}`, a.token)
      assertEquals([r.status, r.body], [404, { error: 'League not found' }], id)
      const e = await api('POST', `/api/leagues/${id}/entrants`, a.token, { name: 'X' })
      assertEquals([e.status, e.body], [404, { error: 'League not found' }], id)
    }
  },
})

Deno.test({
  name: 'a game\'s entrants must belong to the game\'s own league (composite foreign keys; FK checks bypass RLS)',
  ignore: !live,
  fn: async () => {
    const a = await organizer('fk')
    const league = async (name: string) => (await api('POST', '/api/leagues', a.token, { name, location: 'Bar', weeks: 3 })).body.id as string
    const entrant = async (id: string, name: string) => (await api('POST', `/api/leagues/${id}/entrants`, a.token, { name })).body.id as string
    const one = await league('One')
    const two = await league('Two')
    const [h, aw] = [await entrant(one, 'Home'), await entrant(one, 'Away')]
    const stranger = await entrant(two, 'Elsewhere') // A's own, but in league Two
    const game = (home_id: string, away_id: string | null, slot: number) =>
      rest('POST', '/games', a.token, { league_id: one, week: 1, slot, home_id, away_id }, { Prefer: 'return=minimal' })

    // Controls: both entrants from the league, and a bye, are accepted.
    assertEquals((await game(h, aw, 0)).status, 201)
    assertEquals((await game(h, null, 1)).status, 201)
    // An entrant from another league, home or away, is refused by the foreign key (23503).
    for (const [home, away] of [[h, stranger], [stranger, aw], [stranger, null]] as const) {
      const r = await game(home, away, 2)
      assertEquals([r.status, r.body?.code], [409, '23503'], JSON.stringify(r.body))
    }
    assertEquals((await rest('GET', `/games?league_id=eq.${one}&select=slot&order=slot`, a.token)).body, [{ slot: 0 }, { slot: 1 }])
  },
})

Deno.test({
  name: 'replace_schedule is one transaction: a failed insert leaves the old games and weeks untouched (Review Focus 4)',
  ignore: !live,
  fn: async () => {
    const a = await organizer('tx')
    const made = await api('POST', '/api/leagues', a.token, { name: 'Tx', location: 'Bar', weeks: 9 })
    const id = made.body.id as string
    const ents: string[] = []
    for (const name of ['One', 'Two', 'Three', 'Four']) {
      ents.push((await api('POST', `/api/leagues/${id}/entrants`, a.token, { name })).body.id)
    }
    const other = (await api('POST', '/api/leagues', a.token, { name: 'Other', location: 'Bar', weeks: 3 })).body.id as string
    const stranger = (await api('POST', `/api/leagues/${other}/entrants`, a.token, { name: 'Elsewhere' })).body.id as string
    assertEquals((await api('POST', `/api/leagues/${id}/schedule`, a.token)).status, 201)
    const before = (await api('GET', `/api/leagues/${id}/games`, a.token)).body
    assertEquals(before.length, 6)

    // The first game is fine, the second names an entrant of another league: the delete has already run
    // when the foreign key fails on the insert, and all of it must roll back.
    const bad = [
      { week: 1, slot: 0, home_id: ents[0], away_id: ents[1] },
      { week: 1, slot: 1, home_id: ents[2], away_id: stranger },
    ]
    const r = await rest('POST', '/rpc/replace_schedule', a.token, { p_league: id, p_games: bad, p_weeks: 2 })
    assertNotEquals(r.status, 200, JSON.stringify(r.body))
    assertEquals((await api('GET', `/api/leagues/${id}/games`, a.token)).body, before)
    assertEquals((await api('GET', `/api/leagues/${id}`, a.token)).body.weeks, 3) // the weeks the first generate set (4 entrants), not the failed call's 2
  },
})

Deno.test({
  name: 'replace_schedule runs as the caller: another organizer changes nothing, and anon cannot call it',
  ignore: !live,
  fn: async () => {
    const a = await organizer('rs')
    const b = await organizer('rs2')
    const id = (await api('POST', '/api/leagues', a.token, { name: 'Mine', location: 'Bar', weeks: 9 })).body.id as string
    const ents: string[] = []
    for (const name of ['One', 'Two']) ents.push((await api('POST', `/api/leagues/${id}/entrants`, a.token, { name })).body.id)
    await api('POST', `/api/leagues/${id}/schedule`, a.token)
    const before = (await api('GET', `/api/leagues/${id}/games`, a.token)).body
    // B calls the function on A's league: RLS leaves no rows to delete, and the insert is refused.
    const hit = await rest('POST', '/rpc/replace_schedule', b.token, {
      p_league: id, p_games: [{ week: 1, slot: 0, home_id: ents[0], away_id: ents[1] }], p_weeks: 1,
    })
    assertNotEquals(hit.status, 200, JSON.stringify(hit.body))
    assertEquals((await api('GET', `/api/leagues/${id}/games`, a.token)).body, before)
    assertEquals((await api('GET', `/api/leagues/${id}`, a.token)).body.weeks, 1)
    const anon = await call('POST', `${REST}/rpc/replace_schedule`, { apikey: ANON, Authorization: `Bearer ${ANON}` },
      { p_league: id, p_games: [], p_weeks: 1 })
    assertNotEquals(anon.status, 200, JSON.stringify(anon.body))
    assertEquals((await api('GET', `/api/leagues/${id}/games`, a.token)).body, before)
  },
})

Deno.test({
  name: 'standings are RLS-scoped (404 for another organizer) and the public page needs no token, ignores a bad one, and hides ids',
  ignore: !live,
  fn: async () => {
    const a = await organizer('pub')
    const b = await organizer('pub2')
    const made = await api('POST', '/api/leagues', a.token, { name: 'Pub', location: 'Bar', weeks: 3 })
    const id = made.body.id as string
    for (const name of ['One', 'Two']) await api('POST', `/api/leagues/${id}/entrants`, a.token, { name })
    await api('POST', `/api/leagues/${id}/schedule`, a.token)

    const st = await api('GET', `/api/leagues/${id}/standings`, a.token)
    assertEquals([st.status, st.body.rows.length, st.body.played], [200, 2, 0])
    const other = await api('GET', `/api/leagues/${id}/standings`, b.token)
    assertEquals([other.status, other.body], [404, { error: 'League not found' }])
    assertEquals((await api('GET', `/api/leagues/${id}/standings`)).status, 401)

    const slug = made.body.slug as string
    for (const token of [undefined, 'nonsense', b.token]) {
      const r = await call('GET', `${API}/api/public/${slug}`, token ? { Authorization: `Bearer ${token}` } : {})
      assertEquals(r.status, 200, JSON.stringify(r.body))
      assertEquals(Object.keys(r.body).sort(), ['current_week', 'games', 'league', 'standings'])
      assertEquals(r.body.league.id, undefined)
      assertEquals(r.body.league.organizer_id, undefined)
      assertEquals(r.body.league.name, 'Pub')
      assertEquals([r.body.current_week, r.body.games.length], [1, 1])
    }
    const missing = await api('GET', '/api/public/zzzzzz')
    assertEquals([missing.status, missing.body], [404, { error: 'League not found' }])
  },
})
