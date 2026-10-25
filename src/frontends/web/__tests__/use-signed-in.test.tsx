import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { BackendProblem, BackendRefused, SignInRequired } from "../app/api";
import { useSignedIn } from "../app/use-signed-in";

let hook: ReturnType<typeof useSignedIn>;
function Probe() {
  hook = useSignedIn();
  return null;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  replace.mockReset();
});

test("with no token it replaces the page with /signin", () => {
  render(<Probe />);
  expect(replace).toHaveBeenCalledWith("/signin");
});

test("with a token it stays put", () => {
  localStorage.setItem("rlm.token", "t");
  render(<Probe />);
  expect(replace).not.toHaveBeenCalled();
});

test("onError redirects on SignInRequired and otherwise returns the message to show", () => {
  localStorage.setItem("rlm.token", "t");
  render(<Probe />);
  expect(hook.onError(new SignInRequired())).toBeNull();
  expect(replace).toHaveBeenCalledWith("/signin");
  expect(hook.onError(new BackendRefused("Name is required"))).toBe("Name is required");
  expect(hook.onError(new BackendProblem(500))).toBe("The backend had a problem (500)");
  expect(hook.onError(new TypeError("fetch failed"))).toBe("Can't reach the backend at http://localhost:8000");
});
