// The Rec League Manager REST contract (ADR 003), served as one Cloud Function.
// Hosting rewrites /api/** to it (firebase.json), so API_URL = http://localhost:5000
const { onRequest } = require("firebase-functions/v2/https");

const routes = {
  "/api/health": () => ({ status: "ok" }),
  "/api/backend": () => ({ backend: "firebase" }),
};

// cors: true answers preflights and allows any origin; browser frontends run on another port.
exports.api = onRequest({ cors: true }, (req, res) => {
  const route = routes[req.path.replace(/\/+$/, "")];
  if (req.method !== "GET" || !route) return res.status(404).json({ error: "Not found" });
  res.json(route());
});
