import { afterEach, expect, test, vi } from "vitest";

import { BackendRefused, fetchBackendName, fetchHello } from "../app/api";

afterEach(() => vi.unstubAllGlobals());

test("ignores a trailing slash on the API URL", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ backend: "django" }) });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchBackendName("http://localhost:8000/")).toBe("django");
  expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/backend");
});

test("encodes the name and keeps the base path", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "Hello José Ada" }) });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchHello("José Ada", "http://localhost:54321/functions/v1/")).toBe("Hello José Ada");
  expect(fetch).toHaveBeenCalledWith("http://localhost:54321/functions/v1/api/hello?name=Jos%C3%A9+Ada");
});

test("a 400 carries the backend's own error message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "Name is required" }) }));
  await expect(fetchHello("")).rejects.toEqual(new BackendRefused("Name is required"));
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
