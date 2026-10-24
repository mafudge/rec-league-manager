import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import * as jose from 'jsr:@panva/jose@6'
import { ApiError } from './http.ts'
import { createAuth } from './auth.ts'

const SECRET = 'test-secret-test-secret-test-secret-123'
const key = new TextEncoder().encode(SECRET)
const env = { url: 'http://gotrue', anonKey: 'anon-key', jwtSecret: SECRET }

type Call = { url: string; body: Record<string, unknown>; apikey: string | null }
const stub = (status: number, reply: unknown) => {
  const calls: Call[] = []
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body)),
      apikey: new Headers(init?.headers).get('apikey'),
    })
    return Promise.resolve(Response.json(reply, { status }))
  }
  return { calls, auth: createAuth({ fetch, env }) }
}
const session = { access_token: 'AT', refresh_token: 'RT', user: { id: 'u' } }

const refuses = (p: Promise<unknown>, status: number, message: string) =>
  assertRejects(() => p, ApiError, message).then((e) => assertEquals((e as ApiError).status, status))

Deno.test('signup validates email, then password, before GoTrue is called', async () => {
  const { calls, auth } = stub(200, session)
  await refuses(auth.signup('no-at-sign', 'cornhole1'), 400, 'Enter a valid email address')
  await refuses(auth.signup('a@b.com', 'short'), 400, 'Password must be at least 8 characters')
  await refuses(auth.signup('a@b.com', 5 as unknown as string), 400, 'Password must be at least 8 characters')
  await refuses(auth.signup(5 as unknown as string, 'x'), 400, 'Enter a valid email address')
  assertEquals(calls.length, 0)
})

Deno.test('password length counts code points, not UTF-16 units', async () => {
  const { calls, auth } = stub(200, session)
  await refuses(auth.signup('a@b.com', '😀'.repeat(7)), 400, 'Password must be at least 8 characters')
  await auth.signup('a@b.com', '😀'.repeat(8))
  assertEquals(calls.length, 1)
})

Deno.test('passwords over 72 code points are refused before GoTrue is called; 72 pass', async () => {
  const { calls, auth } = stub(200, session)
  const msg = 'Password must be 72 characters or fewer'
  await refuses(auth.signup('a@b.com', 'a'.repeat(73)), 400, msg)
  await refuses(auth.signup('a@b.com', '😀'.repeat(73)), 400, msg)
  await refuses(auth.signup('no-at-sign', 'a'.repeat(73)), 400, 'Enter a valid email address')
  assertEquals(calls.length, 0)
  await auth.signup('a@b.com', '😀'.repeat(72))
  assertEquals(calls.length, 1)
})

Deno.test('signup trims and lower-cases the email, sends the anon key, returns the pair', async () => {
  const { calls, auth } = stub(200, session)
  assertEquals(await auth.signup('  Ann@Example.COM ', 'cornhole1'), { token: 'AT', refresh_token: 'RT' })
  assertEquals(calls[0].url, 'http://gotrue/auth/v1/signup')
  assertEquals(calls[0].body, { email: 'ann@example.com', password: 'cornhole1' })
  assertEquals(calls[0].apikey, 'anon-key')
})

Deno.test('signup maps GoTrue user_already_exists (422) to 409', async () => {
  const { auth } = stub(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
  await refuses(auth.signup('a@b.com', 'cornhole1'), 409, 'An account with that email already exists')
})

Deno.test('signup maps GoTrue email-format refusal to the contract; a long password never reaches it', async () => {
  const bad = stub(400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' })
  await refuses(bad.auth.signup('a@', 'cornhole1'), 400, 'Enter a valid email address')
  const long = stub(400, { code: 400, error_code: 'validation_failed', msg: 'Password cannot be longer than 72 characters' })
  await refuses(long.auth.signup('a@b.com', 'a'.repeat(100)), 400, 'Password must be 72 characters or fewer')
  assertEquals(long.calls.length, 0)
})

Deno.test('a GoTrue failure we cannot name is an ApiError 500, never its body', async () => {
  const { auth } = stub(500, { code: 500, msg: 'database exploded' })
  const e = await assertRejects(() => auth.login('a@b.com', 'cornhole1'), ApiError)
  assertEquals([(e as ApiError).status, (e as ApiError).message], [500, 'The backend had a problem'])
})

Deno.test('a signup answer without a session (autoconfirm off) is a 500', async () => {
  const { auth } = stub(200, { id: 'u', email: 'a@b.com' })
  await refuses(auth.signup('a@b.com', 'cornhole1'), 500, 'The backend had a problem')
})

Deno.test('login sends the password grant and returns the pair', async () => {
  const { calls, auth } = stub(200, session)
  assertEquals(await auth.login(' A@B.com', 'cornhole1'), { token: 'AT', refresh_token: 'RT' })
  assertEquals(calls[0].url, 'http://gotrue/auth/v1/token?grant_type=password')
  assertEquals(calls[0].body, { email: 'a@b.com', password: 'cornhole1' })
})

Deno.test('login: wrong password, unknown email and GoTrue validation all say 401 incorrect', async () => {
  for (const [status, reply] of [
    [400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }],
    [400, { code: 400, error_code: 'validation_failed', msg: 'missing email or phone' }],
  ] as const) {
    const { auth } = stub(status, reply)
    await refuses(auth.login('a@b.com', 'nope'), 401, 'Email or password is incorrect')
  }
})

Deno.test('login with a missing email or password is 401 without asking GoTrue', async () => {
  const { calls, auth } = stub(200, session)
  await refuses(auth.login('', 'x'), 401, 'Email or password is incorrect')
  await refuses(auth.login(undefined as unknown as string, 'x'), 401, 'Email or password is incorrect')
  await refuses(auth.login('a@b.com', 7 as unknown as string), 401, 'Email or password is incorrect')
  assertEquals(calls.length, 0)
})

Deno.test('refresh sends the refresh grant and returns the NEW pair', async () => {
  const { calls, auth } = stub(200, { access_token: 'AT2', refresh_token: 'RT2' })
  assertEquals(await auth.refresh('RT'), { token: 'AT2', refresh_token: 'RT2' })
  assertEquals(calls[0].url, 'http://gotrue/auth/v1/token?grant_type=refresh_token')
  assertEquals(calls[0].body, { refresh_token: 'RT' })
})

Deno.test('refresh: a bad or used token, or no token, is 401 Sign in required', async () => {
  const { calls, auth } = stub(400, { code: 400, error_code: 'validation_failed', msg: 'Refresh token is not valid' })
  await refuses(auth.refresh('garbage'), 401, 'Sign in required')
  const used = stub(400, { code: 400, error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' })
  await refuses(used.auth.refresh('old'), 401, 'Sign in required')
  const none = stub(200, session)
  await refuses(none.auth.refresh(undefined as unknown as string), 401, 'Sign in required')
  await refuses(none.auth.refresh(''), 401, 'Sign in required')
  assertEquals(none.calls.length, 0)
  assertEquals(calls.length, 1)
})

const sign = (claims: Record<string, unknown>, exp: string | number = '1h') =>
  new jose.SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(exp).sign(key)
const bearer = (t: string, scheme = 'Bearer') =>
  new Request('http://x/api/auth/me', { headers: { authorization: `${scheme} ${t}` } })

Deno.test('organizerFrom accepts a valid authenticated token', async () => {
  const { auth } = stub(200, session)
  const t = await sign({ sub: 'u1', role: 'authenticated', email: 'a@b.com' })
  assertEquals(await auth.organizerFrom(bearer(t)), { id: 'u1', email: 'a@b.com', token: t })
  assertEquals((await auth.organizerFrom(bearer(t, 'bearer'))).id, 'u1')
})

Deno.test('organizerFrom: missing, malformed, expired, wrong-role, wrong-key and refresh tokens are 401', async () => {
  const { auth } = stub(200, session)
  const other = await new jose.SignJWT({ sub: 'u', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('another-secret-another-secret-12345'))
  const cases: Request[] = [
    new Request('http://x/api/auth/me'),
    bearer('garbage'),
    bearer(''),
    bearer('opaque-refresh-token-abc123'),
    bearer(await sign({ sub: 'u', role: 'authenticated' }, Math.floor(Date.now() / 1000) - 60)),
    bearer(await sign({ sub: 'u', role: 'anon' })),
    bearer(await sign({ sub: 'u', role: 'service_role' })),
    bearer(await sign({ role: 'authenticated' })),
    bearer(other),
    bearer(await sign({ sub: 'u', role: 'authenticated' }), 'Basic'),
  ]
  for (const r of cases) await refuses(auth.organizerFrom(r), 401, 'Sign in required')
})
