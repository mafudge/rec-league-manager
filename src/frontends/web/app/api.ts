import { clearSession, getRefreshToken, getToken, saveSession } from "./session";

// The one client for every backend: they all serve the same REST contract (ADR 003).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** The backend understood the request and said no, e.g. "Name is required". */
export class BackendRefused extends Error {}

const url = (apiUrl: string, path: string) => new URL(`${apiUrl.replace(/\/+$/, "")}${path}`).toString();

export async function fetchBackendName(apiUrl: string = API_URL): Promise<string> {
  return (await request<{ backend: string }>("GET", "/api/backend", { apiUrl })).backend;
}

export async function fetchHello(name: string, apiUrl: string = API_URL): Promise<string> {
  return (await request<{ message: string }>("GET", `/api/hello?${new URLSearchParams({ name })}`, { apiUrl })).message;
}

/** Signed in is required and could not be restored: send the organizer to /signin. */
export class SignInRequired extends Error {}

/** The backend answered, but with a failure it did not explain (5xx, or a 4xx with no `error`). */
export class BackendProblem extends Error {
  constructor(public status: number) {
    super(`The backend had a problem (${status})`);
  }
}

/** What to show for a failed call: the backend's own words, or where we looked if nothing answered. */
export const messageFor = (e: unknown): string =>
  e instanceof BackendRefused || e instanceof BackendProblem ? e.message : `Can't reach the backend at ${API_URL}`;

type Options = { body?: unknown; auth?: boolean; apiUrl?: string };
type Tokens = { token: string; refresh_token: string };

function send(method: string, href: string, opts: Options, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth && token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(href, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

// One refresh at a time: requests that all hit 401 together share a single refresh call.
let refreshing: Promise<boolean> | null = null;

/** Trade the refresh token for a new pair. False if the backend refuses it; BackendProblem if it merely failed. */
function refreshSession(apiUrl: string): Promise<boolean> {
  refreshing ??= (async () => {
    const refresh_token = getRefreshToken();
    if (!refresh_token) return false;
    const r = await fetch(url(apiUrl, "/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    // Only a refusal (400/401/403) means the tokens are no good. A blip (5xx, 429) must not sign the organizer out.
    if (r.status === 400 || r.status === 401 || r.status === 403) return false;
    if (!r.ok) throw new BackendProblem(r.status);
    saveSession((await r.json()) as Tokens);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * One call for every contract route. A 4xx with an `error` body becomes BackendRefused(error); any other
 * non-2xx becomes BackendProblem. With `auth: true` the bearer token is attached; on 401 the tokens are
 * refreshed once and the call retried, and if that fails the session is cleared and SignInRequired thrown.
 */
export async function request<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const apiUrl = opts.apiUrl ?? API_URL;
  const href = url(apiUrl, path);
  // The session is read only for calls that sign in; the public page never touches it.
  let r = await send(method, href, opts, opts.auth ? getToken() : null);
  if (opts.auth && r.status === 401) {
    if (!(await refreshSession(apiUrl))) {
      clearSession();
      throw new SignInRequired();
    }
    r = await send(method, href, opts, getToken());
    if (r.status === 401) {
      clearSession();
      throw new SignInRequired();
    }
  }
  if (!r.ok) {
    if (r.status >= 400 && r.status < 500) {
      const { error } = await r.json().catch(() => ({ error: undefined }));
      if (typeof error === "string" && error) throw new BackendRefused(error);
    }
    throw new BackendProblem(r.status);
  }
  return r.json();
}

export async function signUp(email: string, password: string): Promise<void> {
  saveSession(await request<Tokens>("POST", "/api/auth/signup", { body: { email, password } }));
}

export async function signIn(email: string, password: string): Promise<void> {
  saveSession(await request<Tokens>("POST", "/api/auth/login", { body: { email, password } }));
}

export const fetchMe = (): Promise<{ email: string }> => request("GET", "/api/auth/me", { auth: true });

export type League = {
  id: string;
  slug: string;
  name: string;
  location: string;
  sport: string;
  season: string;
  weeks: number;
  allow_ties: boolean;
};

/** What the create form sends; `weeks` is null when the box was blank (the backend refuses it). */
export type NewLeague = Omit<League, "id" | "slug" | "weeks"> & { weeks: number | null };

export const listLeagues = (): Promise<League[]> => request("GET", "/api/leagues", { auth: true });
export const createLeague = (input: NewLeague): Promise<League> =>
  request("POST", "/api/leagues", { auth: true, body: input });
export const getLeague = (id: string): Promise<League> =>
  request("GET", `/api/leagues/${encodeURIComponent(id)}`, { auth: true });

export type Entrant = { id: string; name: string };

export const listEntrants = (leagueId: string): Promise<Entrant[]> =>
  request("GET", `/api/leagues/${encodeURIComponent(leagueId)}/entrants`, { auth: true });
export const addEntrant = (leagueId: string, name: string): Promise<Entrant> =>
  request("POST", `/api/leagues/${encodeURIComponent(leagueId)}/entrants`, { auth: true, body: { name } });

export type Game = {
  id: string;
  week: number;
  home_id: string;
  home_name: string;
  away_id: string | null;
  away_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

const leaguePath = (leagueId: string) => `/api/leagues/${encodeURIComponent(leagueId)}`;

export const generateSchedule = (leagueId: string): Promise<{ weeks: number; message: string | null }> =>
  request("POST", `${leaguePath(leagueId)}/schedule`, { auth: true });
export const listGames = (leagueId: string): Promise<Game[]> =>
  request("GET", `${leaguePath(leagueId)}/games`, { auth: true });
export const clearScores = (leagueId: string): Promise<{ cleared: number }> =>
  request("DELETE", `${leaguePath(leagueId)}/scores`, { auth: true });
export const saveScore = (gameId: string, home_score: number | string | null, away_score: number | string | null): Promise<Game> =>
  request("PUT", `/api/games/${encodeURIComponent(gameId)}/score`, { auth: true, body: { home_score, away_score } });

export type StandingsRow = {
  entrant_id: string;
  name: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  diff: number;
};
export type Standings = { rows: StandingsRow[]; played: number; tiebreak: string };

export const getStandings = (leagueId: string): Promise<Standings> =>
  request("GET", `${leaguePath(leagueId)}/standings`, { auth: true });

export type PublicLeague = Omit<League, "id">;
export type PublicView = { league: PublicLeague; current_week: number | null; games: Game[]; standings: Standings };

/** The public page's one call: no token, no sign-in. 404 comes back as BackendRefused("League not found"). */
export const getPublicLeague = (slug: string): Promise<PublicView> =>
  request("GET", `/api/public/${encodeURIComponent(slug)}`);
