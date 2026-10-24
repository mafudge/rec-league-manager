import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

import OrganizerHeader from "../app/organizer-header";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("rlm.token", "t1");
  localStorage.setItem("rlm.refresh_token", "r1");
});
afterEach(() => {
  cleanup();
  push.mockReset();
  replace.mockReset();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body });

test("shows who is signed in", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(200, { email: "dana@example.com" }));
  vi.stubGlobal("fetch", fetch);
  render(<OrganizerHeader />);
  expect(await screen.findByText("dana@example.com")).toBeTruthy();
  expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/api/auth/me");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer t1");
});

test("Sign out forgets the tokens, sends nothing to the backend, and goes to /signin", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(200, { email: "dana@example.com" }));
  vi.stubGlobal("fetch", fetch);
  render(<OrganizerHeader />);
  await screen.findByText("dana@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(localStorage.getItem("rlm.token")).toBeNull();
  expect(localStorage.getItem("rlm.refresh_token")).toBeNull();
  expect(push).toHaveBeenCalledWith("/signin");
  expect(fetch).toHaveBeenCalledTimes(1); // only the /auth/me lookup
});

test("when sign-in can't be restored it goes to /signin", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, { error: "Sign in required" })));
  render(<OrganizerHeader />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
});
