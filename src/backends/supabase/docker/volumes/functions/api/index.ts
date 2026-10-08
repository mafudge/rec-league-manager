// The Rec League Manager REST contract (ADR 003), served as one Edge Function.
// Reached at {SUPABASE_URL}/functions/v1/api/..., so API_URL = http://localhost:54321/functions/v1
// The gateway strips /functions/v1, so this function sees paths like /api/health.

// Browser frontends (web, Flutter) run on another port, so allow any origin.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS })

export default {
  fetch(req: Request): Response {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '')
    if (req.method === 'GET' && path === '/api/health') return json({ status: 'ok' })
    if (req.method === 'GET' && path === '/api/backend') return json({ backend: 'supabase' })
    if (req.method === 'GET' && path === '/api/hello') {
      const name = (url.searchParams.get('name') ?? '').trim()
      return name ? json({ message: `Hello ${name}` }) : json({ error: 'Name is required' }, 400)
    }
    return json({ error: 'Not found' }, 404)
  },
}
