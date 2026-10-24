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

/** The parsed JSON body, which must be an object; anything else is 400 Invalid request. */
export async function objectBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = JSON.parse(await req.text())
  } catch {
    return fail(400, 'Invalid request')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'Invalid request')
  return body as Record<string, unknown>
}

export type Handler = (req: Request, url: URL) => Response | Promise<Response>
export type Route = { method: string; path: string; handler: Handler }

/** Map (method, path) to a handler. Never lets anything but our own {"error"} bodies out. */
export async function handle(req: Request, routes: Route[]): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '')
    const known = routes.filter((r) => r.path === path)
    if (known.length === 0) return fail(404, 'Not Found')
    const route = known.find((r) => r.method === req.method)
    if (!route) return fail(405, 'Method Not Allowed')
    return await route.handler(req, url)
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status)
    console.error('unexpected error', e)
    return json({ error: 'The backend had a problem' }, 500)
  }
}
