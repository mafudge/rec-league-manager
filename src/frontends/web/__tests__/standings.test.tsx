import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { Standings } from "../app/api";
import StandingsTab from "../app/leagues/[id]/standings";
import StandingsTable from "../app/standings-table";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TIEBREAK = "Sorted by wins, then point difference, then points for.";
const row = (name: string, w: number, l: number, t: number, pf: number, pa: number) => ({
  entrant_id: name,
  name,
  w,
  l,
  t,
  pf,
  pa,
  diff: pf - pa,
});
const standings: Standings = {
  rows: [row("Bag Ladies", 1, 0, 0, 21, 14), row("Corn Stars", 0, 0, 0, 0, 0), row("Toss Bosses", 0, 1, 0, 14, 21)],
  played: 1,
  tiebreak: TIEBREAK,
};
const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent);

test("columns are Entrant, W, L, PF, PA, Diff without ties", () => {
  render(<StandingsTable standings={standings} allowTies={false} />);
  expect(headers()).toEqual(["Entrant", "W", "L", "PF", "PA", "Diff"]);
});

test("a T column appears when the league allows ties", () => {
  render(<StandingsTable standings={standings} allowTies />);
  expect(headers()).toEqual(["Entrant", "W", "L", "T", "PF", "PA", "Diff"]);
});

test("rows keep the backend order and Diff has a plus sign only when positive", () => {
  render(<StandingsTable standings={standings} allowTies={false} />);
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
    ["Bag Ladies", "1", "0", "21", "14", "+7"],
    ["Corn Stars", "0", "0", "0", "0", "0"],
    ["Toss Bosses", "0", "1", "14", "21", "-7"],
  ]);
});

test("the tiebreak sentence is printed under the table", () => {
  render(<StandingsTable standings={standings} allowTies={false} />);
  const text = screen.getByText(TIEBREAK);
  expect(screen.getByRole("table").compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("with no games played it says so and still lists every entrant", () => {
  const none = { ...standings, played: 0, rows: standings.rows.map((r) => row(r.name, 0, 0, 0, 0, 0)) };
  render(<StandingsTable standings={none} allowTies={false} />);
  expect(screen.getByText("No games played yet")).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(4);
});

test("once a game is played there is no 'No games played yet'", () => {
  render(<StandingsTable standings={standings} allowTies={false} />);
  expect(screen.queryByText("No games played yet")).toBeNull();
});

test("the Standings tab fetches the standings when it opens", async () => {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => standings }));
  vi.stubGlobal("fetch", fetch);
  render(<StandingsTab leagueId="abc123" allowTies={false} />);
  await waitFor(() => expect(screen.getByText("Bag Ladies")).toBeTruthy());
  expect(new URL((fetch.mock.calls[0] as unknown as [string])[0]).pathname).toBe("/api/leagues/abc123/standings");
});
