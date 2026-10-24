import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import Schedule from "../app/leagues/[id]/schedule";

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const game = (id: string, week: number, home: string, away: string | null) => ({
  id,
  week,
  home_id: `h-${home}`,
  home_name: home,
  away_id: away ? `a-${away}` : null,
  away_name: away,
  home_score: null,
  away_score: null,
});
const generated = [
  game("g1", 1, "Bag Ladies", "Corn Stars"),
  game("g2", 1, "Hole Patrol", null),
  game("g3", 2, "Corn Stars", "Hole Patrol"),
];

/** Backend stub: GET /games returns `games` (starts as given), POST /schedule swaps in `generated`. */
function backend(opts: { games?: unknown[]; post?: [number, unknown] } = {}) {
  let games = opts.games ?? [];
  const fetch = vi.fn(async (href: string, init?: { method?: string }) => {
    const path = new URL(href).pathname;
    const method = init?.method ?? "GET";
    if (path === "/api/leagues/abc123/games") return reply(200, games);
    if (path === "/api/leagues/abc123/schedule" && method === "POST") {
      const [status, body] = opts.post ?? [201, { weeks: 2, message: null }];
      if (status < 400) games = generated;
      return reply(status, body);
    }
    if (path === "/api/leagues/abc123/scores" && method === "DELETE") return reply(200, { cleared: 1 });
    return reply(404, { error: "no route" });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const calls = (f: ReturnType<typeof vi.fn>, method: string, suffix: string) =>
  f.mock.calls.filter(([h, i]) => new URL(h).pathname.endsWith(suffix) && (i?.method ?? "GET") === method);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("rlm.token", "t1");
  localStorage.setItem("rlm.refresh_token", "r1");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("with no games it says there is no schedule yet", async () => {
  backend();
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("No schedule yet — add entrants, then generate.");
});

test("existing games are grouped by week", async () => {
  backend({ games: generated });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Week 1", "Week 2"]);
  expect(screen.queryByText(/No schedule yet/)).toBeNull();
});

test("Generate schedule calls the route and shows weeks and byes", async () => {
  const f = backend();
  render(<Schedule leagueId="abc123" />);
  await screen.findByText(/No schedule yet/);
  fireEvent.click(screen.getByRole("button", { name: "Generate schedule" }));
  await screen.findByText("Hole Patrol — bye");
  expect(calls(f, "POST", "/schedule")).toHaveLength(1);
  expect(screen.getByText("Week 1")).toBeTruthy();
  expect(screen.getByText("Corn Stars vs Hole Patrol")).toBeTruthy();
});

test("the weeks message is shown when present", async () => {
  backend({ post: [201, { weeks: 5, message: "This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8." }] });
  render(<Schedule leagueId="abc123" />);
  fireEvent.click(await screen.findByRole("button", { name: "Generate schedule" }));
  await screen.findByText("This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8.");
});

test.each([
  [400, "Add at least 2 entrants first"],
  [409, "Scores already recorded — clear them first"],
])("a %i refusal is shown as the backend worded it", async (status, error) => {
  backend({ post: [status, { error }] });
  render(<Schedule leagueId="abc123" />);
  fireEvent.click(await screen.findByRole("button", { name: "Generate schedule" }));
  await screen.findByText(error);
});

test("Clear all scores asks first and only deletes on OK", async () => {
  const f = backend({ games: generated });
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  vi.stubGlobal("confirm", confirm);
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  const button = screen.getByRole("button", { name: "Clear all scores" });
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledWith("Clear every score in this league?");
  expect(calls(f, "DELETE", "/scores")).toHaveLength(0);
  fireEvent.click(button);
  await waitFor(() => expect(calls(f, "DELETE", "/scores")).toHaveLength(1));
  // the games are reloaded after clearing
  await waitFor(() => expect(calls(f, "GET", "/games").length).toBeGreaterThanOrEqual(2));
});
