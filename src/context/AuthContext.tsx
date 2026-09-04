import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'sales_rep' | 'rep';
}

interface AuthContextType {
  user: AuthUser | null;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearMustChangePassword: () => void;
}

const SESSION_KEY = 'dhd_auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
  };

  const doLogout = useCallback(() => {
    clearTimer();
    setUser(null);
    setMustChangePassword(false);
    localStorage.removeItem(SESSION_KEY);
    window.location.hash = '#/login';
  }, []);

  // Refresh session 5 minutes before expiry, retry once on network error
  const scheduleRefresh = useCallback((expiresAt: number, refreshToken: string) => {
    clearTimer();
    const msUntilRefresh = expiresAt * 1000 - Date.now() - 5 * 60 * 1000;

    const doRefresh = async (retryOnFail = true) => {
      try {
        const r = await fetch('/api/users?action=refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        const data = await r.json();
        if (data.success) {
          const raw = localStorage.getItem(SESSION_KEY);
          if (raw) {
            const session = JSON.parse(raw);
            session.expiresAt = data.expiresAt;
            session.refreshToken = data.refreshToken;
            if (data.accessToken) session.accessToken = data.accessToken;
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            scheduleRefresh(data.expiresAt, data.refreshToken);
          }
        } else {
          doLogout();
        }
      } catch {
        // Network blip — retry once after 60s, then log out
        if (retryOnFail) {
          refreshTimer.current = setTimeout(() => doRefresh(false), 60_000);
        } else {
          doLogout();
        }
      }
    };

    if (msUntilRefresh <= 0) {
      doRefresh();
    } else {
      refreshTimer.current = setTimeout(doRefresh, msUntilRefresh);
    }
  }, [doLogout]);

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { user: stored, expiresAt, refreshToken, mustChangePassword: mcp } = JSON.parse(raw);
        if (expiresAt && new Date(expiresAt * 1000) <= new Date()) {
          // Expired — clear immediately
          localStorage.removeItem(SESSION_KEY);
        } else {
          setUser(stored);
          setMustChangePassword(mcp || false);
          if (expiresAt && refreshToken) scheduleRefresh(expiresAt, refreshToken);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    return clearTimer;
  }, [scheduleRefresh]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const r = await fetch('/api/users?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!data.success) return false;

      const mcp = data.mustChangePassword || false;
      setUser(data.user);
      setMustChangePassword(mcp);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        user: data.user,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        refreshToken: data.refreshToken,
        mustChangePassword: mcp
      }));
      if (data.expiresAt && data.refreshToken) scheduleRefresh(data.expiresAt, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    clearTimer();
    setUser(null);
    setMustChangePassword(false);
    localStorage.removeItem(SESSION_KEY);
  };

  // Called by Sidebar after successful password change
  const clearMustChangePassword = () => {
    setMustChangePassword(false);
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        session.mustChangePassword = false;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, mustChangePassword, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
