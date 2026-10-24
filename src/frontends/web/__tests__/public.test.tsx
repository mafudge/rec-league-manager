import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "buzr7v" }) }));
vi.mock("../app/session", async (orig) => ({ ...(await orig<object>()), getToken: vi.fn(() => "secret"), getRefreshToken: vi.fn() }));

import { getToken } from "../app/session";
import PublicPage from "../app/l/[slug]/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const game = (id: string, week: number, home: string, away: string | null, hs: number | null = null, as: number | null = null) => ({
  id, week, home_id: `h-${home}`, home_name: home, away_id: away && `a-${away}`, away_name: away, home_score: hs, away_score: as,
});
const row = (name: string, w: number, l: number, pf: number, pa: number) => ({ entrant_id: name, name, w, l, t: 0, pf, pa, diff: pf - pa });
const league = { slug: "buzr7v", name: "Tuesday Cornhole", location: "Joe's Tavern", sport: "Cornhole", season: "Fall 2026", weeks: 2, allow_ties: false };
const body = {
  league,
  current_week: 2,
  games: [
    game("g1", 1, "Bag Ladies", "Corn Stars", 21, 14),
    game("g2", 1, "Hole Patrol", null),
    game("g3", 2, "Corn Stars", "Hole Patrol"),
    game("g4", 2, "Bag Ladies", null),
  ],
  standings: { rows: [row("Bag Ladies", 1, 0, 21, 14), row("Corn Stars", 0, 1, 14, 21), row("Hole Patrol", 0, 0, 0, 0)], played: 1, tiebreak: "Sorted by wins." },
};
const backend = (status: number, b: unknown) => {
  const f = vi.fn(async () => reply(status, b));
  vi.stubGlobal("fetch", f);
  return f;
};

test("name heading, location under it, then sport and season", async () => {
  backend(200, body);
  render(<PublicPage />);
  expect(await screen.findByRole("heading", { level: 1, name: "Tuesday Cornhole" })).toBeTruthy();
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.nextElementSibling?.textContent).toBe("Joe's Tavern");
  expect(screen.getByText("Cornhole · Fall 2026")).toBeTruthy();
});

test("this week comes first, then the full schedule, then standings", async () => {
  backend(200, body);
  render(<PublicPage />);
  await screen.findByText("This week — Week 2");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "This week — Week 2", "Full schedule", "Standings",
  ]);
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Week 1", "Week 2"]);
});

test("games read as scores, matchups and byes", async () => {
  backend(200, body);
  render(<PublicPage />);
  await screen.findByText("Bag Ladies 21 – 14 Corn Stars");
  expect(screen.getAllByText("Corn Stars vs Hole Patrol").length).toBe(2); // this week and full schedule
  expect(screen.getByText("Hole Patrol — bye")).toBeTruthy();
  expect(screen.getByRole("table")).toBeTruthy();
});

test("nothing on the page writes: no buttons, inputs or links", async () => {
  backend(200, body);
  render(<PublicPage />);
  await screen.findByText("Standings");
  expect(screen.queryAllByRole("button")).toEqual([]);
  expect(screen.queryAllByRole("textbox")).toEqual([]);
  expect(screen.queryAllByRole("spinbutton")).toEqual([]);
  expect(screen.queryAllByRole("link")).toEqual([]);
});

test("it never reads the session and sends no Authorization header", async () => {
  const f = backend(200, body);
  render(<PublicPage />);
  await screen.findByText("Standings");
  expect(getToken).not.toHaveBeenCalled();
  expect(f).toHaveBeenCalledTimes(1);
  const [href, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
  expect(new URL(href).pathname).toBe("/api/public/buzr7v");
  expect(init.headers.Authorization).toBeUndefined();
});

test("no schedule says so and still shows standings", async () => {
  backend(200, { ...body, current_week: null, games: [] });
  render(<PublicPage />);
  await screen.findByText("No games scheduled yet");
  expect(screen.queryByText(/This week/)).toBeNull();
  expect(screen.getByText("Standings")).toBeTruthy();
});

test("an unknown league says League not found and shows nothing else", async () => {
  backend(404, { error: "League not found" });
  const { container } = render(<PublicPage />);
  expect(await screen.findByRole("heading", { name: "League not found" })).toBeTruthy();
  expect(screen.queryAllByRole("button")).toEqual([]);
  expect(container.querySelectorAll("table, a").length).toBe(0);
});

test("a backend that can't be reached says so rather than League not found", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("down"); }));
  render(<PublicPage />);
  expect(await screen.findByText(/Can't reach the backend/)).toBeTruthy();
  expect(screen.queryByText("League not found")).toBeNull();
});
