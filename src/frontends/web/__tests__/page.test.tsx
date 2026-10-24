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
  expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/api/backend");
});

test("says where it looked when the backend is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  render(<Home />);
  expect(await screen.findByText("Can't reach the backend at http://localhost:8000")).toBeTruthy();
});

test("says the backend had a problem when it answers with a server error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
  render(<Home />);
  expect(await screen.findByText("The backend had a problem (500)")).toBeTruthy();
  expect(screen.queryByText(/Can't reach/)).toBeNull();
});

test("links to sign up and sign in", () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ backend: "fastapi" }) }));
  render(<Home />);
  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup");
  expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signin");
});
