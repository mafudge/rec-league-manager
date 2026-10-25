// HTTP plumbing for the contract (src/README.md): one JSON error shape, CORS on every
// response, the body rule, and 404/405. Pure web-standard APIs, so Deno tests import it directly.

// Browser frontends (web, Flutter) run on another port, so allow any origin.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS })

/** A refusal with the contract's one shape: {"error": message} and a 4xx status. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const fail = (status: number, message: string): never => {
  throw new ApiError(status, message)
}

const TEXT_FIELDS = ['email', 'password', 'name', 'location', 'sport', 'season']
// U+0000, a high surrogate not followed by a low one, or a low one not preceded by a high one (no `u` flag: it works on UTF-16 units).
const BAD_TEXT = /\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/

/**
 * The parsed JSON body, which must be an object; anything else is 400 Invalid request. So is a text field
 * holding U+0000 or an unpaired surrogate, which Postgres can't store: refused here, before field validation.
 */
export async function objectBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = JSON.parse(await req.text())
  } catch {
    return fail(400, 'Invalid request')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'Invalid request')
  const fields = body as Record<string, unknown>
  for (const f of TEXT_FIELDS) {
    const v = fields[f]
    if (typeof v === 'string' && BAD_TEXT.test(v)) return fail(400, 'Invalid request')
  }
  return fields
}

export type Params = Record<string, string>
export type Handler = (req: Request, url: URL, params: Params) => Response | Promise<Response>
/** `path` may hold `:name` segments, each matching exactly one path segment (e.g. /api/leagues/:id). */
export type Route = { method: string; path: string; handler: Handler }

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment // a broken escape is just an id nothing has, so the route answers its own 404
  }
}

/** The route's params if `path` fits its pattern, else null. */
function match(pattern: string, path: string): Params | null {
  const want = pattern.split('/')
  const got = path.split('/')
  if (want.length !== got.length) return null
  const params: Params = {}
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':') && got[i] !== '') params[want[i].slice(1)] = decode(got[i])
    else if (want[i] !== got[i]) return null
  }
  return params
}

/** Map (method, path) to a handler. Never lets anything but our own {"error"} bodies out. */
export async function handle(req: Request, routes: Route[]): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '')
    const known = routes.flatMap((r) => {
      const params = match(r.path, path)
      return params ? [{ route: r, params }] : []
    })
    if (known.length === 0) return fail(404, 'Not Found')
    const hit = known.find((k) => k.route.method === req.method)
    if (!hit) return fail(405, 'Method Not Allowed')
    return await hit.route.handler(req, url, hit.params)
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status)
    console.error('unexpected error', e)
    return json({ error: 'The backend had a problem' }, 500)
  }
}
