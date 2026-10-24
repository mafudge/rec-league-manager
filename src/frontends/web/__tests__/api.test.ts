import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { BackendProblem, BackendRefused, SignInRequired, fetchBackendName, fetchHello, request, saveScore } from "../app/api";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("ignores a trailing slash on the API URL", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ backend: "django" }) });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchBackendName("http://localhost:8000/")).toBe("django");
  expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/api/backend");
});

test("encodes the name and keeps the base path", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "Hello José Ada" }) });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchHello("José Ada", "http://localhost:54321/functions/v1/")).toBe("Hello José Ada");
  expect(fetch.mock.calls[0][0]).toBe("http://localhost:54321/functions/v1/api/hello?name=Jos%C3%A9+Ada");
});

test("a 400 carries the backend's own error message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "Name is required" }) }));
  await expect(fetchHello("")).rejects.toEqual(new BackendRefused("Name is required"));
});

test("request treats a 409 with an error body as a refusal", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Taken" }) }));
  await expect(request("POST", "/api/x", { body: {} })).rejects.toEqual(new BackendRefused("Taken"));
});

test("an authed call sends the bearer token", async () => {
  localStorage.setItem("rlm.token", "t1");
  const fetch = vi.fn().mockResolvedValue(reply(200, { email: "a@b.c" }));
  vi.stubGlobal("fetch", fetch);
  await request("GET", "/api/auth/me", { auth: true });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer t1");
});

test("refreshes once on 401 and retries", async () => {
  localStorage.setItem("rlm.token", "old");
  localStorage.setItem("rlm.refresh_token", "r-old");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply(401, { error: "Sign in required" }))
    .mockResolvedValueOnce(reply(200, { token: "new", refresh_token: "r-new" }))
    .mockResolvedValueOnce(reply(200, { email: "a@b.c" }));
  vi.stubGlobal("fetch", fetch);
  expect(await request("GET", "/api/auth/me", { auth: true })).toEqual({ email: "a@b.c" });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[1][0]).toBe("http://localhost:8000/api/auth/refresh");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ refresh_token: "r-old" });
  expect(fetch.mock.calls[2][1].headers.Authorization).toBe("Bearer new");
  expect(localStorage.getItem("rlm.token")).toBe("new");
  expect(localStorage.getItem("rlm.refresh_token")).toBe("r-new");
});

test("a failed refresh clears the session and throws SignInRequired", async () => {
  localStorage.setItem("rlm.token", "old");
  localStorage.setItem("rlm.refresh_token", "r-old");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply(401, { error: "Sign in required" }))
    .mockResolvedValueOnce(reply(401, { error: "Sign in required" }));
  vi.stubGlobal("fetch", fetch);
  await expect(request("GET", "/api/auth/me", { auth: true })).rejects.toBeInstanceOf(SignInRequired);
  expect(localStorage.getItem("rlm.token")).toBeNull();
  expect(localStorage.getItem("rlm.refresh_token")).toBeNull();
});

test("a 401 with no refresh token to try throws SignInRequired", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, { error: "Sign in required" })));
  await expect(request("GET", "/api/auth/me", { auth: true })).rejects.toBeInstanceOf(SignInRequired);
});

test("a 401 right after a successful refresh gives up instead of looping", async () => {
  localStorage.setItem("rlm.refresh_token", "r");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply(401, {}))
    .mockResolvedValueOnce(reply(200, { token: "n", refresh_token: "rn" }))
    .mockResolvedValueOnce(reply(401, {}));
  vi.stubGlobal("fetch", fetch);
  await expect(request("GET", "/api/x", { auth: true })).rejects.toBeInstanceOf(SignInRequired);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("a 401 on an unauthenticated call (wrong password) is just a refusal", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(401, { error: "Email or password is incorrect" }));
  vi.stubGlobal("fetch", fetch);
  await expect(request("POST", "/api/auth/login", { body: {} })).rejects.toEqual(
    new BackendRefused("Email or password is incorrect"),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a 5xx or a 4xx without an error body is a backend problem, not unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500, "boom")));
  await expect(request("GET", "/api/x")).rejects.toEqual(new BackendProblem(500));
  await expect(request("GET", "/api/x")).rejects.toThrow("The backend had a problem (500)");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => { throw new Error("not json"); } }));
  await expect(request("GET", "/api/x")).rejects.toThrow("The backend had a problem (404)");
});

// Live: LIVE_API_URL=http://localhost:5000 LIVE_BACKEND=firebase npm test
const live = process.env.LIVE_API_URL;
test.skipIf(!live)("a running backend names itself", async () => {
  const name = await fetchBackendName(live!);
  expect(["fastapi", "django", "supabase", "firebase"]).toContain(name);
  if (process.env.LIVE_BACKEND) expect(name).toBe(process.env.LIVE_BACKEND);
  expect(await fetchHello("Mike", live!)).toBe("Hello Mike");
  await expect(fetchHello(" ", live!)).rejects.toBeInstanceOf(BackendRefused);
});

test("a refresh that meets a 503 keeps the session and reports a backend problem", async () => {
  localStorage.setItem("rlm.token", "old");
  localStorage.setItem("rlm.refresh_token", "r-old");
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(reply(401, { error: "Sign in required" }))
    .mockResolvedValueOnce(reply(503, "unavailable"));
  vi.stubGlobal("fetch", fetch);
  await expect(request("GET", "/api/auth/me", { auth: true })).rejects.toEqual(new BackendProblem(503));
  expect(localStorage.getItem("rlm.token")).toBe("old");
  expect(localStorage.getItem("rlm.refresh_token")).toBe("r-old");
});

test.each([400, 401, 403])("a refresh answered %i is a refusal: the session is cleared", async (status) => {
  localStorage.setItem("rlm.token", "old");
  localStorage.setItem("rlm.refresh_token", "r-old");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(reply(401, {})).mockResolvedValueOnce(reply(status, { error: "no" })),
  );
  await expect(request("GET", "/api/auth/me", { auth: true })).rejects.toBeInstanceOf(SignInRequired);
  expect(localStorage.getItem("rlm.token")).toBeNull();
});

test("two calls that both get 401 share one refresh", async () => {
  localStorage.setItem("rlm.token", "old");
  localStorage.setItem("rlm.refresh_token", "r-old");
  const fetch = vi.fn(async (href: string, init?: { headers?: Record<string, string> }) => {
    if (href.endsWith("/api/auth/refresh")) return reply(200, { token: "new", refresh_token: "r-new" });
    return init?.headers?.Authorization === "Bearer new" ? reply(200, { ok: true }) : reply(401, {});
  });
  vi.stubGlobal("fetch", fetch);
  await Promise.all([request("GET", "/api/a", { auth: true }), request("GET", "/api/b", { auth: true })]);
  expect(fetch.mock.calls.filter(([href]) => String(href).endsWith("/api/auth/refresh"))).toHaveLength(1);
});

test("saveScore encodes the game id like the other paths", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(200, {}));
  vi.stubGlobal("fetch", fetch);
  await saveScore("a/b c", 1, 2);
  expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/api/games/a%2Fb%20c/score");
});
