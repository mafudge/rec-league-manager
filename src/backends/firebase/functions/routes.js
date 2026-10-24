// The contract's routes. Each handler returns [status, body]. Lock routes call organizerFrom first.
const { objectBody } = require("./http");

function createRoutes(auth) {
  return [
    { method: "GET", path: "/api/health", handler: () => [200, { status: "ok" }] },
    { method: "GET", path: "/api/backend", handler: () => [200, { backend: "firebase" }] },
    {
      method: "GET",
      path: "/api/hello",
      handler: (req) => {
        const name = typeof req.query?.name === "string" ? req.query.name.trim() : "";
        return name ? [200, { message: `Hello ${name}` }] : [400, { error: "Name is required" }];
      },
    },
    { method: "POST", path: "/api/auth/signup", handler: async (req) => { const b = objectBody(req); return [201, await auth.signup(b.email, b.password)]; } },
    { method: "POST", path: "/api/auth/login", handler: async (req) => { const b = objectBody(req); return [200, await auth.login(b.email, b.password)]; } },
    { method: "POST", path: "/api/auth/refresh", handler: async (req) => { const b = objectBody(req); return [200, await auth.refresh(b.refresh_token)]; } },
    { method: "GET", path: "/api/auth/me", handler: async (req) => [200, { email: (await auth.organizerFrom(req)).email }] },
  ];
}

module.exports = { createRoutes };
