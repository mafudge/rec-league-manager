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
