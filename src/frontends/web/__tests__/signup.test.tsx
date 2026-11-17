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

function signUp(email = "dana@example.com", password = "cornhole1", signupPassword = "class-pw") {
  render(<AuthForm mode="signup" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Sign-up password"), { target: { value: signupPassword } });
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
  expect(JSON.parse(init.body)).toEqual({
    email: "dana@example.com",
    password: "cornhole1",
    signup_password: "class-pw",
  });
});

test("has a hidden sign-up password box below Password", () => {
  render(<AuthForm mode="signup" />);
  const box = screen.getByLabelText("Sign-up password") as HTMLInputElement;
  expect(box.id).toBe("signup-password");
  expect(box.type).toBe("password");
  expect(box.getAttribute("autocomplete")).toBe("off");
  const password = screen.getByLabelText("Password");
  expect(password.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test.each([
  ["a wrong", "nope"],
  ["an empty", ""],
])("%s sign-up password shows the backend's message and stays on sign-up", async (_kind, signupPassword) => {
  const fetch = vi.fn().mockResolvedValue(reply(403, { error: "Sign-up password is incorrect" }));
  vi.stubGlobal("fetch", fetch);
  signUp("dana@example.com", "cornhole1", signupPassword);
  expect(await screen.findByText("Sign-up password is incorrect")).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[0][1].body).signup_password).toBe(signupPassword);
  expect(localStorage.getItem("rlm.token")).toBeNull();
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
});

test("a backend with sign-up closed says so", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403, { error: "Sign-up is closed" })));
  signUp();
  expect(await screen.findByText("Sign-up is closed")).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
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
