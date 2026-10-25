const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch, objectBody, handler, CORS } = require("../http");
const { createRoutes } = require("../routes");

const routes = createRoutes({});
const body = (s) => ({ rawBody: Buffer.from(s) });

test("body rule: missing, bad JSON and non-objects are Invalid request", () => {
  for (const raw of ["", "{", "[]", '"x"', "5", "null"]) {
    assert.throws(() => objectBody(body(raw)), { status: 400, message: "Invalid request" }, raw);
  }
  assert.throws(() => objectBody({}), { status: 400 });
  assert.deepEqual(objectBody(body('{"a":1}')), { a: 1 });
});

test("text rule: NUL and lone surrogates in text fields", () => {
  for (const f of ["email", "password", "name", "location", "sport", "season"]) {
    for (const bad of ["a\\u0000b", "\\ud800", "x\\udfffy", "\\ud800a"]) {
      assert.throws(() => objectBody(body(`{"${f}":"${bad}"}`)), { status: 400, message: "Invalid request" }, f + bad);
    }
  }
  assert.deepEqual(objectBody(body('{"name":"\\ud83d\\ude00"}')), { name: "😀" });
  assert.deepEqual(objectBody(body('{"other":"\\u0000"}')), { other: "\u0000" });
});

test("404 for unknown path, 405 for wrong method, trailing slash ok", async () => {
  assert.deepEqual(await dispatch({ method: "GET", path: "/api/nope" }, routes), [404, { error: "Not Found" }]);
  assert.deepEqual(await dispatch({ method: "GET", path: "/other" }, routes), [404, { error: "Not Found" }]);
  assert.deepEqual(await dispatch({ method: "GET", path: "/api/auth/login" }, routes), [405, { error: "Method Not Allowed" }]);
  assert.deepEqual(await dispatch({ method: "DELETE", path: "/api/health/" }, routes), [405, { error: "Method Not Allowed" }]);
  assert.deepEqual(await dispatch({ method: "GET", path: "/api/health/" }, routes), [200, { status: "ok" }]);
});

test("an unexpected error is our own 500 shape", async () => {
  const boom = [{ method: "GET", path: "/x", handler: () => { throw new Error("secret"); } }];
  const orig = console.error; console.error = () => {};
  try { assert.deepEqual(await dispatch({ method: "GET", path: "/x" }, boom), [500, { error: "The backend had a problem" }]); } finally { console.error = orig; }
});

test("CORS headers on success, errors and preflight", async () => {
  const mk = () => { const r = { headers: {}, set(h) { Object.assign(this.headers, h); }, status(s) { this.code = s; return this; }, json(b) { this.sent = b; }, end() { this.ended = true; } }; return r; };
  const h = handler(routes);
  for (const [method, path, code] of [["GET", "/api/health", 200], ["GET", "/api/zzz", 404], ["PUT", "/api/health", 405], ["OPTIONS", "/api/health", 204]]) {
    const res = mk();
    await h({ method, path }, res);
    assert.equal(res.code, code);
    assert.equal(res.headers["Access-Control-Allow-Origin"], CORS["Access-Control-Allow-Origin"]);
  }
});
