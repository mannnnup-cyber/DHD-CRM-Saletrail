// Server APIs verify the caller's Supabase access token. This helper reads the
// token persisted by AuthContext (localStorage key 'dhd_auth') so pages can
// attach Authorization headers to authenticated API calls.

export function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('dhd_auth');
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.accessToken || null;
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
