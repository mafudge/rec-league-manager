import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ id: "abc123" }),
  useSearchParams: () => new URLSearchParams(),
}));

import LeaguePage from "../app/leagues/[id]/page";
import LeaguesPage from "../app/leagues/page";
import NewLeaguePage from "../app/leagues/new/page";

const league = (over = {}) => ({
  id: "abc123",
  slug: "k7m2pq",
  name: "Tuesday Cornhole",
  location: "Joe's Tavern",
  sport: "Cornhole",
  season: "Fall 2026",
  weeks: 8,
  allow_ties: false,
  ...over,
});

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

/** Routes by "METHOD path"; /auth/me always answers so the header works. */
function backend(routes: Record<string, unknown>) {
  const fetch = vi.fn(async (href: string, init?: { method?: string }) => {
    const path = new URL(href).pathname;
    if (path === "/api/auth/me") return reply(200, { email: "dana@example.com" });
    const r = routes[`${init?.method ?? "GET"} ${path}`] ?? reply(404, { error: "no route" });
    return r;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const calls = (f: ReturnType<typeof vi.fn>, key: string) =>
  f.mock.calls.filter(([h, i]) => `${i?.method ?? "GET"} ${new URL(h).pathname}` === key);

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

test("an empty list says so and links to create a league", async () => {
  backend({ "GET /api/leagues": reply(200, []) });
  render(<LeaguesPage />);
  expect(await screen.findByText("No leagues yet — create one.")).toBeTruthy();
  const link = screen.getByRole("link", { name: "Create a league" });
  expect(link.getAttribute("href")).toBe("/leagues/new");
});

test("a list shows each league's name and location, linked to its home", async () => {
  backend({
    "GET /api/leagues": reply(200, [league(), league({ id: "z9", name: "Thursday Darts", location: "The Pub" })]),
  });
  render(<LeaguesPage />);
  expect(await screen.findByText("Tuesday Cornhole")).toBeTruthy();
  expect(screen.getByText("Joe's Tavern")).toBeTruthy();
  expect(screen.getByText("Thursday Darts")).toBeTruthy();
  expect(screen.getByText("The Pub")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Thursday Darts/ }).getAttribute("href")).toBe("/leagues/z9");
});

test("the list page shows the backend's message when it refuses", async () => {
  backend({ "GET /api/leagues": reply(500, {}) });
  render(<LeaguesPage />);
  expect(await screen.findByText("The backend had a problem (500)")).toBeTruthy();
});

test("with no token the pages go to /signin", async () => {
  localStorage.clear();
  backend({ "GET /api/leagues": reply(401, { error: "Sign in required" }) });
  render(<LeaguesPage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
});

test("the form has its fields and the tie box starts unchecked", () => {
  backend({});
  render(<NewLeaguePage />);
  for (const label of ["Name", "Location", "Sport", "Season", "Weeks"]) expect(screen.getByLabelText(label)).toBeTruthy();
  expect((screen.getByLabelText("Games can end in a tie") as HTMLInputElement).checked).toBe(false);
});

function fill() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Tuesday Cornhole" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Joe's Tavern" } });
  fireEvent.change(screen.getByLabelText("Sport"), { target: { value: "Cornhole" } });
  fireEvent.change(screen.getByLabelText("Season"), { target: { value: "Fall 2026" } });
  fireEvent.change(screen.getByLabelText("Weeks"), { target: { value: "8" } });
}

test("submitting sends the values and goes to the new league", async () => {
  const fetch = backend({ "POST /api/leagues": reply(201, league()) });
  render(<NewLeaguePage />);
  fill();
  fireEvent.click(screen.getByLabelText("Games can end in a tie"));
  fireEvent.click(screen.getByRole("button", { name: "Create league" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues/abc123"));
  const [, init] = calls(fetch, "POST /api/leagues")[0];
  expect(JSON.parse(init.body)).toEqual({
    name: "Tuesday Cornhole",
    location: "Joe's Tavern",
    sport: "Cornhole",
    season: "Fall 2026",
    weeks: 8,
    allow_ties: true,
  });
  expect(init.headers.Authorization).toBe("Bearer t1");
});

test("a blank Weeks box is sent as-is for the backend to refuse, not guessed", async () => {
  const fetch = backend({ "POST /api/leagues": reply(400, { error: "Weeks must be at least 1" }) });
  render(<NewLeaguePage />);
  fill();
  fireEvent.change(screen.getByLabelText("Weeks"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Create league" }));
  expect(await screen.findByText("Weeks must be at least 1")).toBeTruthy();
  expect(JSON.parse(calls(fetch, "POST /api/leagues")[0][1].body).weeks).toBeNull();
});

test("a 400 shows the backend's message and stays on the form", async () => {
  backend({ "POST /api/leagues": reply(400, { error: "Location is required" }) });
  render(<NewLeaguePage />);
  fill();
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Create league" }));
  expect(await screen.findByText("Location is required")).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Tuesday Cornhole");
});

test("the form with no token goes to /signin", async () => {
  localStorage.clear();
  backend({});
  render(<NewLeaguePage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin"));
});

test("the league home shows name, location, sport · season and copies the public link", async () => {
  backend({ "GET /api/leagues/abc123": reply(200, league()) });
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<LeaguePage />);
  expect(await screen.findByRole("heading", { name: "Tuesday Cornhole" })).toBeTruthy();
  expect(screen.getByText("Joe's Tavern")).toBeTruthy();
  expect(screen.getByText("Cornhole · Fall 2026")).toBeTruthy();
  expect(await screen.findByText("dana@example.com")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copy public link" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${location.origin}/l/k7m2pq`));
  expect(await screen.findByText("Link copied")).toBeTruthy();
});

test("the sport · season line leaves out what is blank", async () => {
  backend({ "GET /api/leagues/abc123": reply(200, league({ season: "" })) });
  render(<LeaguePage />);
  expect(await screen.findByText("Cornhole")).toBeTruthy();
});

test("another organizer's league shows the backend's 404 message", async () => {
  backend({ "GET /api/leagues/abc123": reply(404, { error: "League not found" }) });
  render(<LeaguePage />);
  expect(await screen.findByText("League not found")).toBeTruthy();
});
