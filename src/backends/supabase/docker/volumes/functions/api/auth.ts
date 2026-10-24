// Accounts: GoTrue (Supabase Auth) behind the contract's auth routes.
// GoTrue's own bodies ({"code":…,"msg":…}) never leave this file; we map by status and error_code.
import * as jose from 'jsr:@panva/jose@6'
import { ApiError, fail } from './http.ts'

export type Env = { url: string; anonKey: string; jwtSecret: string }
export type Deps = { fetch: typeof fetch; env: Env | (() => Env) }
export type Tokens = { token: string; refresh_token: string }
export type Organizer = { id: string; email: string; token: string }

const SIGN_IN = 'Sign in required'
const BAD_LOGIN = 'Email or password is incorrect'
const PROBLEM = 'The backend had a problem'

const codePoints = (s: string) => [...s].length
const cleanEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')

export function createAuth(deps: Deps) {
  const env = () => (typeof deps.env === 'function' ? deps.env() : deps.env)

  // Call GoTrue; returns its status and JSON body (or {} if it had none).
  async function gotrue(path: string, body: Record<string, unknown>) {
    const { url, anonKey } = env()
    const res = await deps.fetch(`${url}/auth/v1${path}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const reply = await res.json().catch(() => ({}))
    return { status: res.status, reply: (reply ?? {}) as Record<string, unknown> }
  }

  function tokensFrom(status: number, reply: Record<string, unknown>): Tokens {
    const { access_token, refresh_token } = reply
    if (status === 200 && typeof access_token === 'string' && typeof refresh_token === 'string') {
      return { token: access_token, refresh_token }
    }
    console.error('GoTrue gave no session', status, reply.error_code ?? reply.msg)
    return fail(500, PROBLEM)
  }

  const unexpected = (what: string, status: number, reply: Record<string, unknown>) => {
    console.error(`GoTrue ${what} failed`, status, reply.error_code ?? reply.msg)
    return fail(500, PROBLEM)
  }

  async function signup(email: unknown, password: unknown): Promise<Tokens> {
    const address = cleanEmail(email)
    if (!address.includes('@')) fail(400, 'Enter a valid email address')
    if (typeof password !== 'string' || codePoints(password) < 8) return fail(400, 'Password must be at least 8 characters')
    if (codePoints(password) > 72) return fail(400, 'Password must be 72 characters or fewer')
    const { status, reply } = await gotrue('/signup', { email: address, password })
    if (status === 200) return tokensFrom(status, reply)
    const msg = String(reply.msg ?? '')
    if (reply.error_code === 'user_already_exists' || reply.error_code === 'email_exists') {
      return fail(409, 'An account with that email already exists')
    }
    if (reply.error_code === 'validation_failed' && /email/i.test(msg)) return fail(400, 'Enter a valid email address')
    // any other GoTrue refusal: the contract has no message for it (over-72 passwords are refused above, never sent)
    if (status === 400 || status === 422) return fail(400, 'Invalid request')
    return unexpected('signup', status, reply)
  }

  async function login(email: unknown, password: unknown): Promise<Tokens> {
    const address = cleanEmail(email)
    // One refusal for unknown email and wrong/missing password, so the form can't be used to find accounts.
    if (!address || typeof password !== 'string' || !password) return fail(401, BAD_LOGIN)
    const { status, reply } = await gotrue('/token?grant_type=password', { email: address, password })
    if (status === 200) return tokensFrom(status, reply)
    if (status === 400 || status === 401 || status === 422) return fail(401, BAD_LOGIN)
    return unexpected('login', status, reply)
  }

  async function refresh(token: unknown): Promise<Tokens> {
    if (typeof token !== 'string' || !token) return fail(401, SIGN_IN)
    const { status, reply } = await gotrue('/token?grant_type=refresh_token', { refresh_token: token })
    if (status === 200) return tokensFrom(status, reply)
    if (status === 400 || status === 401 || status === 403 || status === 422) return fail(401, SIGN_IN)
    return unexpected('refresh', status, reply)
  }

  /** The signed-in organizer for a 🔒 route; anything less is 401 "Sign in required". */
  async function organizerFrom(req: Request): Promise<Organizer> {
    const [scheme, ...rest] = (req.headers.get('authorization') ?? '').split(' ')
    const token = rest.join(' ').trim()
    if (scheme.toLowerCase() !== 'bearer' || !token) return fail(401, SIGN_IN)
    try {
      // Access tokens are HS256 JWTs signed with JWT_SECRET; GoTrue refresh tokens are opaque and fail here.
      // The anon and service-role keys are JWTs too, but their role is not "authenticated".
      const { payload } = await jose.jwtVerify(token, new TextEncoder().encode(env().jwtSecret), {
        algorithms: ['HS256'],
      })
      if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || !payload.sub) throw new Error('not a user token')
      return { id: payload.sub, email: cleanEmail(payload.email), token }
    } catch (e) {
      if (e instanceof ApiError) throw e
      return fail(401, SIGN_IN)
    }
  }

  return { signup, login, refresh, organizerFrom }
}

// The running function: read the environment on first use, so importing this file needs no runtime.
export const auth = createAuth({
  fetch: (input, init) => fetch(input, init),
  env: () => ({
    url: Deno.env.get('SUPABASE_URL') ?? '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    jwtSecret: Deno.env.get('JWT_SECRET') ?? '',
  }),
})
