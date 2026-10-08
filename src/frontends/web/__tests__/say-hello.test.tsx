import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import SayHello from "../app/say-hello";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: object) => ({ ok: status === 200, status, json: async () => body });

function sayHello(name: string) {
  render(<SayHello />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Say hello" }));
}

test("shows what the backend replies", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(200, { message: "Hello Mike" }));
  vi.stubGlobal("fetch", fetch);
  sayHello("Mike");
  expect(await screen.findByText("Hello Mike")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/hello?name=Mike");
});

test("a blank name is sent as typed, and the backend's refusal is shown", async () => {
  const fetch = vi.fn().mockResolvedValue(reply(400, { error: "Name is required" }));
  vi.stubGlobal("fetch", fetch);
  sayHello("");
  expect(await screen.findByText("Name is required")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/hello?name=");
});

test("says where it looked when the backend is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
  sayHello("Mike");
  expect(await screen.findByText("Can't reach the backend at http://localhost:8000")).toBeTruthy();
});

test("pressing Enter submits the form too", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { message: "Hello Ada" })));
  render(<SayHello />);
  const box = screen.getByLabelText("Your name");
  fireEvent.change(box, { target: { value: "Ada" } });
  fireEvent.submit(box.closest("form")!);
  expect(await screen.findByText("Hello Ada")).toBeTruthy();
});
