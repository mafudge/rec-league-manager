const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuth } = require("../auth");
const { dispatch } = require("../http");
const { createRoutes } = require("../routes");

const reply = (status, body) => async () => ({ status, json: async () => body });
function make({ fetch = reply(200, {}), verify = async () => ({ uid: "u1", email: "A@B.com" }) } = {}) {
  const calls = [];
  const auth = createAuth({
    fetch: (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return fetch(url, init); },
    host: () => "emu:9099",
    verifyIdToken: verify,
  });
  return { auth, calls };
}
const session = { idToken: "T", refreshToken: "R" };
const err = (message) => ({ error: { code: 400, message } });

test("signup validation order, before the emulator is called", async () => {
  const { auth, calls } = make();
  await assert.rejects(auth.signup("nope", "short"), { status: 400, message: "Enter a valid email address" });
  await assert.rejects(auth.signup("a@b.c", "short"), { status: 400, message: "Password must be at least 8 characters" });
  await assert.rejects(auth.signup("a@b.c", undefined), { status: 400, message: "Password must be at least 8 characters" });
  await assert.rejects(auth.signup("a@b.c", "x".repeat(73)), { status: 400, message: "Password must be 72 characters or fewer" });
  await assert.rejects(auth.signup("a@b.c", "😀".repeat(19)), { status: 400, message: "Password must be 72 characters or fewer" });
  assert.equal(calls.length, 0);
});

test("signup success trims and lower-cases; 72 bytes allowed", async () => {
  const { auth, calls } = make({ fetch: reply(200, session) });
  assert.deepEqual(await auth.signup("  Me@X.com ", "😀".repeat(18)), { token: "T", refresh_token: "R" });
  assert.equal(calls[0].body.email, "me@x.com");
  assert.match(calls[0].url, /^http:\/\/emu:9099\/identitytoolkit\.googleapis\.com\/v1\/accounts:signUp\?key=/);
});

test("signup maps EMAIL_EXISTS to 409 and hides unknown failures", async () => {
  await assert.rejects(make({ fetch: reply(400, err("EMAIL_EXISTS")) }).auth.signup("a@b.c", "password1"), { status: 409, message: "An account with that email already exists" });
  await assert.rejects(make({ fetch: reply(400, err("INVALID_EMAIL")) }).auth.signup("a@b", "password1"), { status: 400, message: "Enter a valid email address" });
  const orig = console.error; console.error = () => {};
  try { await assert.rejects(make({ fetch: reply(503, err("BOOM")) }).auth.signup("a@b.c", "password1"), { status: 500, message: "The backend had a problem" }); } finally { console.error = orig; }
});

test("login: every bad credential is the one 401", async () => {
  for (const m of ["EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS", "USER_DISABLED"]) {
    await assert.rejects(make({ fetch: reply(400, err(m)) }).auth.login("a@b.c", "password1"), { status: 401, message: "Email or password is incorrect" }, m);
  }
  const { auth, calls } = make();
  await assert.rejects(auth.login("", "x"), { status: 401, message: "Email or password is incorrect" });
  await assert.rejects(auth.login("a@b.c", 5), { status: 401 });
  await assert.rejects(auth.login("a@b.c", ""), { status: 401 });
  assert.equal(calls.length, 0);
  assert.deepEqual(await make({ fetch: reply(200, session) }).auth.login("a@b.c", "password1"), { token: "T", refresh_token: "R" });
});

test("refresh: any failure is Sign in required; success maps snake_case keys", async () => {
  await assert.rejects(make().auth.refresh(undefined), { status: 401, message: "Sign in required" });
  await assert.rejects(make({ fetch: reply(400, err("INVALID_REFRESH_TOKEN")) }).auth.refresh("x"), { status: 401, message: "Sign in required" });
  await assert.rejects(make({ fetch: reply(400, err("TOKEN_EXPIRED")) }).auth.refresh("x"), { status: 401, message: "Sign in required" });
  assert.deepEqual(await make({ fetch: reply(200, { id_token: "T2", refresh_token: "R2" }) }).auth.refresh("x"), { token: "T2", refresh_token: "R2" });
});

test("organizerFrom: missing, malformed, rejected tokens are Sign in required", async () => {
  const bad = make({ verify: async () => { throw new Error("expired"); } }).auth;
  for (const authorization of [undefined, "", "Bearer", "Bearer ", "Basic abc", "Bearer garbage", "garbage"]) {
    await assert.rejects(bad.organizerFrom({ headers: { authorization } }), { status: 401, message: "Sign in required" }, String(authorization));
  }
  const good = make().auth;
  assert.deepEqual(await good.organizerFrom({ headers: { authorization: "bearer tok" } }), { id: "u1", email: "a@b.com", token: "tok" });
});

test("routes: bodies, 201 on signup, open routes ignore Authorization, /me needs sign-in", async () => {
  const { auth } = make({ fetch: reply(200, session), verify: async () => { throw new Error("no"); } });
  const routes = createRoutes(auth);
  const post = (path, raw, headers = {}) => dispatch({ method: "POST", path, rawBody: Buffer.from(raw), headers }, routes);
  assert.deepEqual(await post("/api/auth/signup", "[]"), [400, { error: "Invalid request" }]);
  assert.deepEqual(await post("/api/auth/signup", '{"email":"a@b.c","password":"\\u0000password"}'), [400, { error: "Invalid request" }]);
  assert.deepEqual(await post("/api/auth/signup", '{"email":"a@b.c","password":"password1"}', { authorization: "Bearer junk" }), [201, { token: "T", refresh_token: "R" }]);
  assert.deepEqual(await post("/api/auth/login", '{"email":"a@b.c","password":"password1"}', { authorization: "garbage" }), [200, { token: "T", refresh_token: "R" }]);
  assert.deepEqual(await dispatch({ method: "GET", path: "/api/auth/me", headers: {} }, routes), [401, { error: "Sign in required" }]);
});
