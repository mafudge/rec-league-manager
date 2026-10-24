// HTTP plumbing for the contract (src/README.md): one JSON error shape, CORS on every
// response, the body rule, the text rule, and 404/405. No Firebase imports, so node --test loads it.

// Browser frontends (web, Flutter) run on another port, so allow any origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

/** A refusal with the contract's one shape: {"error": message} and a 4xx status. */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new ApiError(status, message);
};

const TEXT_FIELDS = ["email", "password", "name", "location", "sport", "season"];
// U+0000, a high surrogate not followed by a low one, or a low one not preceded by a high one (no `u` flag: it works on UTF-16 units).
const BAD_TEXT = /\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

/**
 * The parsed JSON body, which must be an object; anything else is 400 Invalid request. So is a text field
 * holding U+0000 or an unpaired surrogate: refused here, before field validation, nothing stored.
 */
function objectBody(req) {
  let body;
  try {
    const raw = req.rawBody ?? "";
    body = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw));
  } catch {
    return fail(400, "Invalid request");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(400, "Invalid request");
  for (const f of TEXT_FIELDS) {
    if (typeof body[f] === "string" && BAD_TEXT.test(body[f])) return fail(400, "Invalid request");
  }
  return body;
}

const decode = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // a broken escape is just an id nothing has, so the route answers its own 404
  }
};

/** The route's params if `path` fits its pattern (`:name` matches one non-empty segment), else null. */
function match(pattern, path) {
  const want = pattern.split("/");
  const got = path.split("/");
  if (want.length !== got.length) return null;
  const params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":") && got[i] !== "") params[want[i].slice(1)] = decode(got[i]);
    else if (want[i] !== got[i]) return null;
  }
  return params;
}

/** Map a request to [status, body]. Never lets anything but our own {"error"} bodies out. routes: [{method, path, handler(req, params)}] */
async function dispatch(req, routes) {
  try {
    const path = (req.path || "/").replace(/\/+$/, "");
    const known = routes.flatMap((r) => {
      const params = match(r.path, path);
      return params ? [{ route: r, params }] : [];
    });
    if (known.length === 0) return fail(404, "Not Found");
    const hit = known.find((k) => k.route.method === req.method);
    if (!hit) return fail(405, "Method Not Allowed");
    return await hit.route.handler(req, hit.params);
  } catch (e) {
    if (e instanceof ApiError) return [e.status, { error: e.message }];
    console.error("unexpected error", e);
    return [500, { error: "The backend had a problem" }];
  }
}

/** The function's request handler: dispatch, then write JSON with CORS headers. */
const handler = (routes) => async (req, res) => {
  res.set(CORS);
  if (req.method === "OPTIONS") return res.status(204).end();
  const [status, body] = await dispatch(req, routes);
  res.status(status).json(body);
};

module.exports = { CORS, ApiError, fail, objectBody, dispatch, handler };
