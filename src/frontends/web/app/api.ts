// The one client for every backend: they all serve the same REST contract (ADR 003).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const base = (apiUrl: string) => apiUrl.replace(/\/+$/, "");

export async function fetchBackendName(apiUrl: string = API_URL): Promise<string> {
  const r = await fetch(`${base(apiUrl)}/api/backend`);
  if (!r.ok) throw new Error(`GET /api/backend returned ${r.status}`);
  const { backend } = await r.json();
  return backend;
}
