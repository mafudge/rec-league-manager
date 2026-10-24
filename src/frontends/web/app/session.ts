// The organizer's tokens live in localStorage; every access is guarded because storage can be blocked.
const TOKEN = "rlm.token";
const REFRESH = "rlm.refresh_token";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveSession(t: { token: string; refresh_token: string }): void {
  try {
    localStorage.setItem(TOKEN, t.token);
    localStorage.setItem(REFRESH, t.refresh_token);
  } catch {
    /* storage blocked: the session just won't survive a reload */
  }
}

export const getToken = (): string | null => read(TOKEN);
export const getRefreshToken = (): string | null => read(REFRESH);

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(REFRESH);
  } catch {
    /* nothing to clear */
  }
}
