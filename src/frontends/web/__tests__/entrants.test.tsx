import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "abc123" }),
  useSearchParams: () => new URLSearchParams(search),
}));

import Entrants from "../app/leagues/[id]/entrants";
import LeaguePage from "../app/leagues/[id]/page";
import { LeagueTabs } from "../app/leagues/[id]/tabs";

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const league = { id: "abc123", slug: "k7m2pq", name: "Tuesday Cornhole", location: "Joe's", sport: "", season: "", weeks: 8, allow_ties: false };

/** A tiny in-memory backend for /entrants plus the league and header calls. */
function backend(initial: string[] = []) {
  const entrants = initial.map((name, i) => ({ id: `e${i}`, name }));
  const fetch = vi.fn(async (href: string, init?: { method?: string; body?: string }) => {
    const path = new URL(href).pathname;
    const method = init?.method ?? "GET";
    if (path === "/api/auth/me") return reply(200, { email: "dana@example.com" });
    if (path === "/api/leagues/abc123") return reply(200, league);
    if (path === "/api/leagues/abc123/entrants" && method === "GET") return reply(200, entrants);
    if (path === "/api/leagues/abc123/entrants" && method === "POST") {
      const name = JSON.parse(init!.body!).name.trim();
      if (!name) return reply(400, { error: "Name is required" });
      if (entrants.some((e) => e.name.toLowerCase() === name.toLowerCase()))
        return reply(409, { error: "An entrant with that name already exists in this league" });
      const e = { id: `e${entrants.length}`, name };
      entrants.push(e);
      return reply(201, e);
    }
    return reply(404, { error: "no route" });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  search = "";
  localStorage.clear();
  localStorage.setItem("rlm.token", "t1");
  localStorage.setItem("rlm.refresh_token", "r1");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("existing entrants are listed in order", async () => {
  backend(["Bag Ladies", "Corn Stars"]);
  render(<Entrants leagueId="abc123" />);
  await screen.findByText("Corn Stars");
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Bag Ladies", "Corn Stars"]);
});

test("adding shows the name in the list and clears the box", async () => {
  backend();
  render(<Entrants leagueId="abc123" />);
  const box = (await screen.findByLabelText("Name")) as HTMLInputElement;
  fireEvent.change(box, { target: { value: "Bag Ladies" } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(await screen.findByText("Bag Ladies")).toBeTruthy();
  await waitFor(() => expect(box.value).toBe(""));
});

test("the backend's refusal is shown as-is and the box keeps what was typed", async () => {
  backend(["Bag Ladies"]);
  render(<Entrants leagueId="abc123" />);
  const box = (await screen.findByLabelText("Name")) as HTMLInputElement;
  await screen.findByText("Bag Ladies");
  fireEvent.change(box, { target: { value: " bag ladies " } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(await screen.findByText("An entrant with that name already exists in this league")).toBeTruthy();
  expect(box.value).toBe(" bag ladies ");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("a blank name is sent to the backend, which says Name is required", async () => {
  const f = backend();
  render(<Entrants leagueId="abc123" />);
  await screen.findByLabelText("Name");
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(await screen.findByText("Name is required")).toBeTruthy();
  expect(f.mock.calls.some(([, i]) => i?.method === "POST")).toBe(true);
});

test("the form is one row: the name field and the Add button share a form", async () => {
  backend();
  render(<Entrants leagueId="abc123" />);
  const box = await screen.findByLabelText("Name");
  const add = screen.getByRole("button", { name: "Add" });
  const form = box.closest("form")!;
  expect(form.contains(add)).toBe(true);
  expect(form.querySelectorAll("input, button")).toHaveLength(2);
  expect(form.className).toMatch(/addRow/);
});

test("the tab bar marks the active tab and links with ?tab=", () => {
  render(<LeagueTabs active="schedule" />);
  const links = screen.getAllByRole("link");
  expect(links.map((a) => a.textContent)).toEqual(["Entrants", "Schedule", "Standings"]);
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["?tab=entrants", "?tab=schedule", "?tab=standings"]);
  expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, "page", null]);
});

test("the league home opens on Entrants by default", async () => {
  backend(["Bag Ladies"]);
  render(<LeaguePage />);
  expect(await screen.findByText("Bag Ladies")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Entrants" }).getAttribute("aria-current")).toBe("page");
});

test("the Schedule and Standings tabs show only the tab bar for now", async () => {
  for (const tab of ["schedule", "standings"]) {
    search = `tab=${tab}`;
    const f = backend(["Bag Ladies"]);
    const { unmount } = render(<LeaguePage />);
    await screen.findByText("Tuesday Cornhole");
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByText("Bag Ladies")).toBeNull();
    expect(f.mock.calls.some(([h]) => new URL(h).pathname.endsWith("/entrants"))).toBe(false);
    unmount();
  }
});
