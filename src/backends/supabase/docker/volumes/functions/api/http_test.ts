import { assertEquals } from 'jsr:@std/assert@1'
import { ApiError, fail, handle, json, objectBody, type Route } from './http.ts'

const req = (method: string, path: string, body?: string, headers: HeadersInit = {}) =>
  new Request(`http://x${path}`, { method, body, headers })

const routes: Route[] = [
  { method: 'GET', path: '/api/ping', handler: () => json({ pong: true }) },
  { method: 'POST', path: '/api/echo', handler: async (r) => json(await objectBody(r), 201) },
  { method: 'GET', path: '/api/refuse', handler: () => fail(409, 'Nope') },
  { method: 'GET', path: '/api/boom', handler: () => { throw new Error('secret detail') } },
]

const call = async (r: Request) => {
  const res = await handle(r, routes)
  return { res, body: res.status === 204 ? null : await res.json() }
}

Deno.test('json carries the status and CORS', async () => {
  const res = json({ a: 1 }, 201)
  assertEquals(res.status, 201)
  assertEquals(res.headers.get('access-control-allow-origin'), '*')
  assertEquals(await res.json(), { a: 1 })
})

Deno.test('a known route answers; a trailing slash is accepted', async () => {
  for (const p of ['/api/ping', '/api/ping/']) {
    const { res, body } = await call(req('GET', p))
    assertEquals([res.status, body], [200, { pong: true }])
  }
})

Deno.test('unknown path is 404 Not Found, with CORS', async () => {
  for (const p of ['/api/nope', '/api/', '/api', '/other']) {
    const { res, body } = await call(req('GET', p))
    assertEquals([res.status, body], [404, { error: 'Not Found' }])
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
  }
})

Deno.test('wrong method on a known path is 405 Method Not Allowed, with CORS', async () => {
  const { res, body } = await call(req('DELETE', '/api/ping'))
  assertEquals([res.status, body], [405, { error: 'Method Not Allowed' }])
  assertEquals(res.headers.get('access-control-allow-origin'), '*')
})

Deno.test('OPTIONS is a 204 preflight with CORS on any path', async () => {
  for (const p of ['/api/ping', '/api/nope']) {
    const res = await handle(req('OPTIONS', p), routes)
    assertEquals(res.status, 204)
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
    assertEquals(res.headers.get('access-control-allow-headers')?.includes('authorization'), true)
  }
})

Deno.test('an ApiError becomes {error} with its status and CORS', async () => {
  const { res, body } = await call(req('GET', '/api/refuse'))
  assertEquals([res.status, body], [409, { error: 'Nope' }])
  assertEquals(res.headers.get('access-control-allow-origin'), '*')
})

Deno.test('an unexpected exception is a generic 500 that leaks nothing', async () => {
  const orig = console.error
  console.error = () => {}
  try {
    const { res, body } = await call(req('GET', '/api/boom'))
    assertEquals([res.status, body], [500, { error: 'The backend had a problem' }])
    assertEquals(res.headers.get('access-control-allow-origin'), '*')
  } finally {
    console.error = orig
  }
})

Deno.test('body rule: missing, broken or non-object bodies are 400 Invalid request', async () => {
  for (const b of [undefined, '', '{', 'NaN', '[]', '"x"', '5', 'null', 'true']) {
    const { res, body } = await call(req('POST', '/api/echo', b))
    assertEquals([res.status, body], [400, { error: 'Invalid request' }], `body ${b}`)
  }
})

Deno.test('body rule: an object passes through', async () => {
  const { res, body } = await call(req('POST', '/api/echo', '{"a":1}'))
  assertEquals([res.status, body], [201, { a: 1 }])
})

Deno.test('ApiError carries status and message', () => {
  const e = new ApiError(401, 'x')
  assertEquals([e.status, e.message], [401, 'x'])
})

// Routes with :params (Task 2: /api/leagues/:id and below)
const paramRoutes: Route[] = [
  { method: 'GET', path: '/api/leagues', handler: () => json({ list: true }) },
  { method: 'GET', path: '/api/leagues/:id', handler: (_r, _u, p) => json({ id: p.id }) },
  { method: 'GET', path: '/api/leagues/:id/entrants', handler: (_r, _u, p) => json({ entrants: p.id }) },
  { method: 'POST', path: '/api/leagues/:id/entrants', handler: (_r, _u, p) => json({ added: p.id }, 201) },
]
const callP = async (r: Request) => {
  const res = await handle(r, paramRoutes)
  return [res.status, await res.json()]
}

Deno.test('a :param segment matches one path segment and is passed to the handler', async () => {
  assertEquals(await callP(req('GET', '/api/leagues')), [200, { list: true }])
  assertEquals(await callP(req('GET', '/api/leagues/abc')), [200, { id: 'abc' }])
  assertEquals(await callP(req('GET', '/api/leagues/abc/')), [200, { id: 'abc' }])
  assertEquals(await callP(req('GET', '/api/leagues/abc/entrants')), [200, { entrants: 'abc' }])
  assertEquals(await callP(req('POST', '/api/leagues/abc/entrants', '{}')), [201, { added: 'abc' }])
})

Deno.test('a :param is percent-decoded; a broken escape is passed through raw, never a 500', async () => {
  assertEquals(await callP(req('GET', '/api/leagues/a%20b')), [200, { id: 'a b' }])
  assertEquals(await callP(req('GET', '/api/leagues/%zz')), [200, { id: '%zz' }])
})

Deno.test('extra or missing segments are 404; a wrong method on a :param path is 405', async () => {
  assertEquals(await callP(req('GET', '/api/leagues/abc/nope')), [404, { error: 'Not Found' }])
  assertEquals(await callP(req('GET', '/api/leagues/abc/entrants/x')), [404, { error: 'Not Found' }])
  assertEquals(await callP(req('DELETE', '/api/leagues/abc')), [405, { error: 'Method Not Allowed' }])
  assertEquals(await callP(req('PUT', '/api/leagues/abc/entrants')), [405, { error: 'Method Not Allowed' }])
})

// The text rule (src/README.md): U+0000 or an unpaired surrogate in a text field is 400 Invalid request.
const BAD_TEXT = ['\\u0000', 'A\\u0000B', '\\ud800', 'x\\udc00y', '\\ud83d', 'a\\ud83dz']
const TEXT_FIELDS = ['email', 'password', 'name', 'location', 'sport', 'season']

Deno.test('NUL or a lone surrogate in any text field is 400 Invalid request', async () => {
  for (const field of TEXT_FIELDS) {
    for (const bad of BAD_TEXT) {
      const { res, body } = await call(req('POST', '/api/echo', `{"${field}": "${bad}", "other": "fine"}`))
      assertEquals([res.status, body], [400, { error: 'Invalid request' }], `${field} ${bad}`)
    }
  }
})

Deno.test('ordinary text, emoji pairs and other keys pass the text rule', async () => {
  const text = '{"name": "Caf\\u00e9 \\ud83d\\ude00", "note": "\\u0000 is fine in a field no route stores", "n": 5}'
  const { res, body } = await call(req('POST', '/api/echo', text))
  assertEquals([res.status, (body as { name: string }).name], [201, 'Café 😀'])
})
