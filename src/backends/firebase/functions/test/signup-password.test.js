// US13-02: sign-up needs the server's SIGNUP_PASSWORD (src/README.md, signup row). Mirrors FastAPI's test_signup_password.py.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuth } = require("../auth");
const { dispatch } = require("../http");
const { createRoutes } = require("../routes");

const SP = "s3cret q é";
const INCORRECT = { status: 403, message: "Sign-up password is incorrect" };
const CLOSED = { status: 403, message: "Sign-up is closed" };
const session = { idToken: "T", refreshToken: "R" };

// An Auth emulator stand-in that records calls; `exists` emails answer EMAIL_EXISTS.
function make({ exists = [] } = {}) {
  const calls = [];
  const auth = createAuth({
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      if (exists.includes(body.email)) return { status: 400, json: async () => ({ error: { code: 400, message: "EMAIL_EXISTS" } }) };
      return { status: 200, json: async () => session };
    },
    host: () => "emu:9099",
    verifyIdToken: async () => ({ uid: "u1", email: "a@b.com" }),
  });
  return { auth, calls };
}

// Set SIGNUP_PASSWORD (undefined = unset) for one test and put the old value back afterwards.
function withServer(t, value) {
  const had = Object.prototype.hasOwnProperty.call(process.env, "SIGNUP_PASSWORD");
  const old = process.env.SIGNUP_PASSWORD;
  if (value === undefined) delete process.env.SIGNUP_PASSWORD;
  else process.env.SIGNUP_PASSWORD = value;
  t.after(() => {
    if (had) process.env.SIGNUP_PASSWORD = old;
    else delete process.env.SIGNUP_PASSWORD;
  });
}

test("AC1: the right sign-up password creates the account", async (t) => {
  withServer(t, SP);
  const { auth, calls } = make();
  assert.deepEqual(await auth.signup("dana@example.com", "cornhole1", SP), { token: "T", refresh_token: "R" });
  assert.equal(calls.length, 1);
  assert.equal("signup_password" in calls[0].body, false); // never passed on to the Auth emulator
});

test("AC2: wrong, missing or non-text sign-up passwords are refused before the emulator is called", async (t) => {
  withServer(t, SP);
  const { auth, calls } = make();
  for (const given of ["wrong", "", SP + " ", SP.toUpperCase(), "s3cret q e", 5, null, undefined, ["x"], { p: SP }]) {
    await assert.rejects(auth.signup("dana@example.com", "cornhole1", given), INCORRECT, JSON.stringify(given));
  }
  assert.equal(calls.length, 0);
});

test("AC3: a wrong sign-up password wins over a duplicate email", async (t) => {
  withServer(t, SP);
  const { auth, calls } = make({ exists: ["dana@example.com"] });
  await assert.rejects(auth.signup("dana@example.com", "cornhole1", SP), { status: 409 });
  await assert.rejects(auth.signup("dana@example.com", "cornhole1", "wrong"), INCORRECT);
  assert.equal(calls.length, 1);
});

test("AC3: a wrong sign-up password wins over a bad email and password", async (t) => {
  withServer(t, SP);
  await assert.rejects(make().auth.signup("nope", "x", "wrong"), INCORRECT);
});

for (const server of [undefined, ""]) {
  test(`AC4: SIGNUP_PASSWORD ${server === undefined ? "unset" : "empty"} means sign-up is closed`, async (t) => {
    withServer(t, server);
    const { auth, calls } = make();
    await assert.rejects(auth.signup("dana@example.com", "cornhole1", SP), CLOSED);
    await assert.rejects(auth.signup("dana@example.com", "cornhole1", ""), CLOSED);
    await assert.rejects(auth.signup("dana@example.com", "cornhole1", undefined), CLOSED);
    assert.equal(calls.length, 0);
  });
}

test("AC4: closed wins over the field checks", async (t) => {
  withServer(t, undefined);
  await assert.rejects(make().auth.signup("nope", "x"), CLOSED);
});

test("the server's password is read on every request", async (t) => {
  withServer(t, "first-one");
  const { auth } = make();
  await assert.rejects(auth.signup("dana@example.com", "cornhole1", SP), INCORRECT);
  assert.deepEqual(await auth.signup("dana@example.com", "cornhole1", "first-one"), { token: "T", refresh_token: "R" });
  process.env.SIGNUP_PASSWORD = "second-one";
  await assert.rejects(auth.signup("dana@example.com", "cornhole1", "first-one"), INCORRECT);
});

test("non-ASCII sign-up passwords work", async (t) => {
  withServer(t, "café-😀");
  assert.deepEqual(await make().auth.signup("dana@example.com", "cornhole1", "café-😀"), { token: "T", refresh_token: "R" });
  await assert.rejects(make().auth.signup("dana@example.com", "cornhole1", "cafe-😀"), INCORRECT);
});

test("route: signup_password comes from the body; the text rule refuses it with 400 before the 403s", async (t) => {
  withServer(t, SP);
  const routes = createRoutes(make().auth);
  const post = (body) => dispatch({ method: "POST", path: "/api/auth/signup", rawBody: Buffer.from(body), headers: {} }, routes);
  const ok = JSON.stringify({ email: "a@b.c", password: "password1", signup_password: SP });
  assert.deepEqual(await post(ok), [201, { token: "T", refresh_token: "R" }]);
  assert.deepEqual(await post('{"email":"a@b.c","password":"password1"}'), [403, { error: "Sign-up password is incorrect" }]);
  assert.deepEqual(await post('{"email":"a@b.c","password":"password1","signup_password":"x\\u0000"}'), [400, { error: "Invalid request" }]);
  assert.deepEqual(await post('{"email":"a@b.c","password":"password1","signup_password":"\\ud800"}'), [400, { error: "Invalid request" }]);
  assert.deepEqual(await post("[]"), [400, { error: "Invalid request" }]);
  delete process.env.SIGNUP_PASSWORD;
  assert.deepEqual(await post('{"email":"a@b.c","password":"password1","signup_password":"\\ud800"}'), [400, { error: "Invalid request" }]);
  assert.deepEqual(await post(ok), [403, { error: "Sign-up is closed" }]);
});
