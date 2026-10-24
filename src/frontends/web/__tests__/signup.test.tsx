import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import AuthForm from "../app/auth-form";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body });

function signUp(email = "dana@example.com", password = "cornhole1") {
  render(<AuthForm mode="signup" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
}

test("creates the account and goes to my leagues", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(201, { token: "t1", refresh_token: "r1" }));
  vi.stubGlobal("fetch", fetch);
  signUp();
  await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues"));
  expect(localStorage.getItem("rlm.token")).toBe("t1");
  expect(localStorage.getItem("rlm.refresh_token")).toBe("r1");
  const [href, init] = fetch.mock.calls[0];
  expect(href).toBe("http://localhost:8000/api/auth/signup");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ email: "dana@example.com", password: "cornhole1" });
});

test("shows the backend's refusal", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(409, { error: "An account with that email already exists" })));
  signUp();
  expect(await screen.findByText("An account with that email already exists")).toBeTruthy();
  expect(localStorage.getItem("rlm.token")).toBeNull();
  expect(push).not.toHaveBeenCalled();
});

test("says where it looked when the backend is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  signUp();
  expect(await screen.findByText("Can't reach the backend at http://localhost:8000")).toBeTruthy();
});

test("links to sign in", () => {
  render(<AuthForm mode="signup" />);
  expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signin");
});
