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
function backend(opts: { games?: unknown[]; entrants?: string[]; post?: [number, unknown]; put?: [number, unknown] } = {}) {
  let games = opts.games ?? [];
  const fetch = vi.fn(async (href: string, init?: { method?: string }) => {
    const path = new URL(href).pathname;
    const method = init?.method ?? "GET";
    if (path === "/api/leagues/abc123/games") return reply(200, games);
    if (path === "/api/leagues/abc123/entrants")
      return reply(200, (opts.entrants ?? ["Bag Ladies", "Corn Stars", "Hole Patrol"]).map((n) => ({ id: `h-${n}`, name: n })));
    if (path === "/api/leagues/abc123/schedule" && method === "POST") {
      const [status, body] = opts.post ?? [201, { weeks: 2, message: null }];
      if (status < 400) games = generated;
      return reply(status, body);
    }
    const put = path.match(/^\/api\/games\/(\w+)\/score$/);
    if (put && method === "PUT") {
      const [status, body] = opts.put ?? [200, null];
      if (status >= 400) return reply(status, body);
      const sent = JSON.parse((init as { body: string }).body);
      games = games.map((g) => ((g as { id: string }).id === put[1] ? { ...(g as object), ...sent } : g));
      return reply(200, games.find((g) => (g as { id: string }).id === put[1]));
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

const type = (label: string, value: string) =>
  fireEvent.change(screen.getAllByLabelText(label)[0], { target: { value } });

test("each game has two labelled number inputs and a Save button; a bye has none", async () => {
  backend({ games: generated });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  for (const label of ["Bag Ladies score", "Corn Stars score", "Hole Patrol score"]) {
    const el = screen.getAllByLabelText(label)[0] as HTMLInputElement;
    expect(el.type).toBe("number");
    expect(el.min).toBe("0");
    expect(el.step).toBe("1");
  }
  expect(screen.getAllByRole("button", { name: /^Save/ })).toHaveLength(2);
  const bye = screen.getByText("Hole Patrol — bye").closest("li")!;
  expect(bye.querySelectorAll("input")).toHaveLength(0);
});

test("saving sends the scores and shows the game as played, still editable", async () => {
  const f = backend({ games: generated });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  type("Bag Ladies score", "21");
  type("Corn Stars score", "14");
  fireEvent.click(screen.getAllByRole("button", { name: /^Save/ })[0]);
  await screen.findByText("Bag Ladies 21 – 14 Corn Stars");
  const [, init] = calls(f, "PUT", "/score")[0];
  expect(JSON.parse(init.body)).toEqual({ home_score: 21, away_score: 14 });
  expect((screen.getAllByLabelText("Bag Ladies score")[0] as HTMLInputElement).value).toBe("21");
  expect((screen.getAllByLabelText("Corn Stars score")[0] as HTMLInputElement).value).toBe("14");
  // correcting it replaces the score
  type("Corn Stars score", "17");
  fireEvent.click(screen.getAllByRole("button", { name: /^Save/ })[0]);
  await screen.findByText("Bag Ladies 21 – 17 Corn Stars");
});

test("blank inputs are sent as empty strings (null means Clear) so the backend's message shows next to that game", async () => {
  const f = backend({ games: generated, put: [400, { error: "Scores must be whole numbers 0 or greater" }] });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  fireEvent.click(screen.getAllByRole("button", { name: /^Save/ })[0]);
  const msg = await screen.findByText("Scores must be whole numbers 0 or greater");
  expect(JSON.parse(calls(f, "PUT", "/score")[0][1].body)).toEqual({ home_score: "", away_score: "" });
  expect(msg.closest("li")!.textContent).toContain("Bag Ladies");
  expect(screen.getByText("Bag Ladies vs Corn Stars")).toBeTruthy();
});

test("a tie refusal is shown as the backend worded it", async () => {
  backend({ games: generated, put: [400, { error: "This league doesn't allow ties" }] });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  type("Bag Ladies score", "15");
  type("Corn Stars score", "15");
  fireEvent.click(screen.getAllByRole("button", { name: /^Save/ })[0]);
  await screen.findByText("This league doesn't allow ties");
});

test("Clear appears only on a played game, sends both null with no confirmation, and the row reads unplayed again", async () => {
  const confirm = vi.fn(() => true);
  vi.stubGlobal("confirm", confirm);
  window.confirm = confirm;
  const scored = [{ ...generated[0], home_score: 21, away_score: 14 }, generated[1], generated[2]];
  const f = backend({ games: scored });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies 21 – 14 Corn Stars");
  // one played game, one unplayed game, one bye: a single Clear
  expect(screen.getAllByRole("button", { name: /^Clear Bag Ladies vs Corn Stars/ })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: /^Clear (?!all)/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear Bag Ladies vs Corn Stars" }));
  await screen.findByText("Bag Ladies vs Corn Stars");
  expect(JSON.parse(calls(f, "PUT", "/score")[0][1].body)).toEqual({ home_score: null, away_score: null });
  expect(confirm).not.toHaveBeenCalled();
  expect((screen.getAllByLabelText("Bag Ladies score")[0] as HTMLInputElement).value).toBe("");
  expect((screen.getAllByLabelText("Corn Stars score")[0] as HTMLInputElement).value).toBe("");
  expect(screen.queryAllByRole("button", { name: /^Clear (?!all)/ })).toHaveLength(0);
  expect(calls(f, "GET", "/games").length).toBeGreaterThanOrEqual(2); // reloaded
});

test("one blank input with Save sends \"\" for it and shows the backend's message", async () => {
  const f = backend({ games: generated, put: [400, { error: "Scores must be whole numbers 0 or greater" }] });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  type("Bag Ladies score", "21");
  fireEvent.click(screen.getAllByRole("button", { name: /^Save/ })[0]);
  await screen.findByText("Scores must be whole numbers 0 or greater");
  expect(JSON.parse(calls(f, "PUT", "/score")[0][1].body)).toEqual({ home_score: 21, away_score: "" });
});

const STALE = "Regenerate the schedule to include new entrants.";

test("an entrant with no games shows the regenerate warning above the weeks", async () => {
  backend({ games: generated, entrants: ["Bag Ladies", "Corn Stars", "Hole Patrol", "Late Joiners"] });
  render(<Schedule leagueId="abc123" />);
  const warning = await screen.findByText(STALE);
  const week1 = screen.getByRole("heading", { name: "Week 1" });
  expect(warning.compareDocumentPosition(week1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("no warning when every entrant has a game", async () => {
  backend({ games: generated });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("Bag Ladies vs Corn Stars");
  expect(screen.queryByText(STALE)).toBeNull();
});

test("no warning when there is no schedule yet", async () => {
  backend({ entrants: ["Bag Ladies", "Corn Stars"] });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText("No schedule yet — add entrants, then generate.");
  expect(screen.queryByText(STALE)).toBeNull();
});

test("generating clears the warning", async () => {
  backend({ games: [game("g9", 1, "Bag Ladies", "Corn Stars")], entrants: ["Bag Ladies", "Corn Stars", "Hole Patrol"] });
  render(<Schedule leagueId="abc123" />);
  await screen.findByText(STALE);
  fireEvent.click(screen.getByRole("button", { name: "Generate schedule" }));
  await waitFor(() => expect(screen.queryByText(STALE)).toBeNull());
});
