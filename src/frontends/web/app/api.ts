import { saveSession } from "./session";

// The one client for every backend: they all serve the same REST contract (ADR 003).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** The backend understood the request and said no, e.g. "Name is required". */
export class BackendRefused extends Error {}

const url = (apiUrl: string, path: string, query?: Record<string, string>) => {
  const u = new URL(`${apiUrl.replace(/\/+$/, "")}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v);
  return u.toString();
};

async function get(href: string) {
  const r = await fetch(href);
  if (r.status === 400) {
    const { error } = await r.json();
    throw new BackendRefused(error ?? "The backend refused the request");
  }
  if (!r.ok) throw new Error(`GET ${href} returned ${r.status}`);
  return r.json();
}

export async function fetchBackendName(apiUrl: string = API_URL): Promise<string> {
  return (await get(url(apiUrl, "/api/backend"))).backend;
}

export async function fetchHello(name: string, apiUrl: string = API_URL): Promise<string> {
  return (await get(url(apiUrl, "/api/hello", { name }))).message;
}

/** Signed in is required and could not be restored: send the organizer to /signin. */
export class SignInRequired extends Error {}

type Options = { body?: unknown; auth?: boolean; apiUrl?: string };

/**
 * One call for every contract route. Any 4xx with an `error` body becomes BackendRefused(error).
 * Task 3 (US01) completes `auth: true`: attach the bearer token, and on 401 refresh once, retry,
 * and throw SignInRequired if the refresh fails. Until then `auth` is accepted but not acted on.
 */
export async function request<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const href = url(opts.apiUrl ?? API_URL, path);
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(href, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (r.status >= 400 && r.status < 500) {
    const { error } = await r.json().catch(() => ({ error: undefined }));
    if (error) throw new BackendRefused(error);
    throw new Error(`${method} ${href} returned ${r.status}`);
  }
  if (!r.ok) throw new Error(`${method} ${href} returned ${r.status}`);
  return r.json();
}

type Tokens = { token: string; refresh_token: string };

export async function signUp(email: string, password: string): Promise<void> {
  saveSession(await request<Tokens>("POST", "/api/auth/signup", { body: { email, password } }));
}

export async function signIn(email: string, password: string): Promise<void> {
  saveSession(await request<Tokens>("POST", "/api/auth/login", { body: { email, password } }));
}
