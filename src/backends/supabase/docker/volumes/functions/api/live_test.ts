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
