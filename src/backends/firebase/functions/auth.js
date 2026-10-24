// Accounts: the Firebase Auth emulator behind the contract's auth routes.
// The emulator's own bodies ({"error":{"code":400,"message":"EMAIL_EXISTS"}}) never leave this file; we map by message.
const { fail, ApiError } = require("./http");

const SIGN_IN = "Sign in required";
const BAD_LOGIN = "Email or password is incorrect";
const PROBLEM = "The backend had a problem";

const codePoints = (s) => [...s].length;
const cleanEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * deps.fetch: injectable for tests. deps.host(): "host:port" of the Auth emulator.
 * deps.verifyIdToken(token): resolves to the decoded token (uid, email) or rejects.
 */
function createAuth(deps) {
  const base = () => `http://${deps.host()}`;

  // POST JSON; returns the status and JSON body (or {} if it had none).
  async function post(url, body) {
    const res = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const reply = await res.json().catch(() => ({}));
    return { status: res.status, reply: reply ?? {} };
  }

  const identity = (op, body) => post(`${base()}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=demo`, body);
  const code = (reply) => String(reply?.error?.message ?? "").split(" ")[0];

  function tokensFrom(status, reply, idKey = "idToken", refreshKey = "refreshToken") {
    const token = reply[idKey];
    const refresh_token = reply[refreshKey];
    if (status === 200 && typeof token === "string" && typeof refresh_token === "string") return { token, refresh_token };
    console.error("Auth emulator gave no session", status, code(reply));
    return fail(500, PROBLEM);
  }

  async function signup(email, password) {
    const address = cleanEmail(email);
    if (!address.includes("@")) fail(400, "Enter a valid email address");
    if (typeof password !== "string" || codePoints(password) < 8) fail(400, "Password must be at least 8 characters");
    if (Buffer.byteLength(password, "utf8") > 72) fail(400, "Password must be 72 characters or fewer");
    const { status, reply } = await identity("signUp", { email: address, password, returnSecureToken: true });
    if (status === 200) return tokensFrom(status, reply);
    const c = code(reply);
    if (c === "EMAIL_EXISTS") return fail(409, "An account with that email already exists");
    if (c === "INVALID_EMAIL") return fail(400, "Enter a valid email address");
    if (status === 400) return fail(400, "Invalid request");
    console.error("Auth emulator signup failed", status, c);
    return fail(500, PROBLEM);
  }

  async function login(email, password) {
    const address = cleanEmail(email);
    // One refusal for unknown email and wrong/missing password, so the form can't be used to find accounts.
    if (!address || typeof password !== "string" || !password) return fail(401, BAD_LOGIN);
    const { status, reply } = await identity("signInWithPassword", { email: address, password, returnSecureToken: true });
    if (status === 200) return tokensFrom(status, reply);
    if (status === 400 || status === 401) return fail(401, BAD_LOGIN);
    console.error("Auth emulator login failed", status, code(reply));
    return fail(500, PROBLEM);
  }

  async function refresh(token) {
    if (typeof token !== "string" || !token) return fail(401, SIGN_IN);
    const { status, reply } = await post(`${base()}/securetoken.googleapis.com/v1/token?key=demo`, {
      grant_type: "refresh_token",
      refresh_token: token,
    });
    if (status === 200) return tokensFrom(status, reply, "id_token", "refresh_token");
    if (status >= 400 && status < 500) return fail(401, SIGN_IN);
    console.error("Auth emulator refresh failed", status, code(reply));
    return fail(500, PROBLEM);
  }

  /** The signed-in organizer for a 🔒 route; anything less is 401 "Sign in required". */
  async function organizerFrom(req) {
    const header = req.headers?.authorization ?? req.get?.("authorization") ?? "";
    const [scheme, ...rest] = String(header).split(" ");
    const token = rest.join(" ").trim();
    if (scheme.toLowerCase() !== "bearer" || !token) return fail(401, SIGN_IN);
    try {
      const decoded = await deps.verifyIdToken(token);
      if (!decoded?.uid) throw new Error("not a user token");
      return { id: decoded.uid, email: cleanEmail(decoded.email), token };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      return fail(401, SIGN_IN);
    }
  }

  return { signup, login, refresh, organizerFrom };
}

module.exports = { createAuth };
