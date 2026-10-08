import { afterEach, expect, test, vi } from "vitest";

import { fetchBackendName } from "../app/api";

afterEach(() => vi.unstubAllGlobals());

test("ignores a trailing slash on the API URL", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ backend: "django" }) });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchBackendName("http://localhost:8000/")).toBe("django");
  expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/backend");
});

// Live: LIVE_API_URL=http://localhost:5000 LIVE_BACKEND=firebase npm test
const live = process.env.LIVE_API_URL;
test.skipIf(!live)("a running backend names itself", async () => {
  const name = await fetchBackendName(live!);
  expect(["fastapi", "django", "supabase", "firebase"]).toContain(name);
  if (process.env.LIVE_BACKEND) expect(name).toBe(process.env.LIVE_BACKEND);
});
