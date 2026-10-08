import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import Home from "../app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("says hello from the backend that answered", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ backend: "supabase" }) });
  vi.stubGlobal("fetch", fetch);
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Rec League Manager" })).toBeTruthy();
  expect(await screen.findByText("Hello from supabase")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/backend");
});

test("says where it looked when the backend is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  render(<Home />);
  expect(await screen.findByText("Can't reach the backend at http://localhost:8000")).toBeTruthy();
});

test("treats an error status as unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  render(<Home />);
  expect(await screen.findByText("Can't reach the backend at http://localhost:8000")).toBeTruthy();
});
