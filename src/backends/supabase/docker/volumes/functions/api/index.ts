// The Rec League Manager REST contract (ADR 003), served as one Edge Function.
// Reached at {SUPABASE_URL}/functions/v1/api/..., so API_URL = http://localhost:54321/functions/v1
// The gateway strips /functions/v1, so this function sees paths like /api/health.
import { auth } from './auth.ts'
import { handle, json, objectBody, type Route } from './http.ts'

const routes: Route[] = [
  { method: 'GET', path: '/api/health', handler: () => json({ status: 'ok' }) },
  { method: 'GET', path: '/api/backend', handler: () => json({ backend: 'supabase' }) },
  {
    method: 'GET',
    path: '/api/hello',
    handler: (_req, url) => {
      const name = (url.searchParams.get('name') ?? '').trim()
      return name ? json({ message: `Hello ${name}` }) : json({ error: 'Name is required' }, 400)
    },
  },
  {
    method: 'POST',
    path: '/api/auth/signup',
    handler: async (req) => {
      const body = await objectBody(req)
      return json(await auth.signup(body.email, body.password), 201)
    },
  },
  {
    method: 'POST',
    path: '/api/auth/login',
    handler: async (req) => {
      const body = await objectBody(req)
      return json(await auth.login(body.email, body.password))
    },
  },
  {
    method: 'POST',
    path: '/api/auth/refresh',
    handler: async (req) => json(await auth.refresh((await objectBody(req)).refresh_token)),
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    handler: async (req) => json({ email: (await auth.organizerFrom(req)).email }),
  },
]

export default {
  fetch: (req: Request): Promise<Response> => handle(req, routes),
}
