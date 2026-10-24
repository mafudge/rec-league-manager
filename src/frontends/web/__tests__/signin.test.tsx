import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import SignInPage from "../app/signin/page";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body });

function signIn(password = "cornhole1") {
  render(<SignInPage />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dana@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

test("the right password stores the tokens and goes to my leagues", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(200, { token: "t1", refresh_token: "r1" }));
  vi.stubGlobal("fetch", fetch);
  signIn();
  await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues"));
  expect(localStorage.getItem("rlm.token")).toBe("t1");
  expect(localStorage.getItem("rlm.refresh_token")).toBe("r1");
  expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/api/auth/login");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: "dana@example.com", password: "cornhole1" });
});

test("a wrong password shows the backend's refusal and goes nowhere", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, { error: "Email or password is incorrect" })));
  signIn("wrong-wrong");
  expect(await screen.findByText("Email or password is incorrect")).toBeTruthy();
  expect(localStorage.getItem("rlm.token")).toBeNull();
  expect(push).not.toHaveBeenCalled();
  expect(screen.queryByText(/league/i)).toBeNull();
});

test("a server error says the backend had a problem, not that it is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500, {})));
  signIn();
  expect(await screen.findByText("The backend had a problem (500)")).toBeTruthy();
});

test("an unreachable backend says where it looked", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  signIn();
  expect(await screen.findByText("Can't reach the backend at http://localhost:8000")).toBeTruthy();
});

test("links to sign up", () => {
  render(<SignInPage />);
  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup");
});
