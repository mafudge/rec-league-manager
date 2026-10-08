// The Rec League Manager REST contract (ADR 003), served as one Cloud Function.
// Hosting rewrites /api/** to it (firebase.json), so API_URL = http://localhost:5000
const { onRequest } = require("firebase-functions/v2/https");

// Each route returns [status, body].
const routes = {
  "/api/health": () => [200, { status: "ok" }],
  "/api/backend": () => [200, { backend: "firebase" }],
  "/api/hello": (req) => {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    return name ? [200, { message: `Hello ${name}` }] : [400, { error: "Name is required" }];
  },
};

// cors: true answers preflights and allows any origin; browser frontends run on another port.
exports.api = onRequest({ cors: true }, (req, res) => {
  const route = routes[req.path.replace(/\/+$/, "")];
  if (req.method !== "GET" || !route) return res.status(404).json({ error: "Not found" });
  const [status, body] = route(req);
  res.status(status).json(body);
});
