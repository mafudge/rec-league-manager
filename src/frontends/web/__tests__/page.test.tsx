import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import Home from "../app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows the title and the backend status", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }));
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Rec League Manager" })).toBeTruthy();
  expect(await screen.findByText("Backend: ok")).toBeTruthy();
});

test("says so when the backend is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  render(<Home />);
  expect(await screen.findByText("Backend: backend unreachable")).toBeTruthy();
});
