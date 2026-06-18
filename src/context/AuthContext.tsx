import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'sales_rep' | 'rep';
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const SESSION_KEY = 'dhd_auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleExpiry = (expiresAt: number) => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    const msUntilExpiry = expiresAt * 1000 - Date.now();
    if (msUntilExpiry <= 0) return;
    expiryTimer.current = setTimeout(() => {
      setUser(null);
      localStorage.removeItem(SESSION_KEY);
      window.location.hash = '#/login';
    }, msUntilExpiry);
  };

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { user: stored, expiresAt } = JSON.parse(raw);
        if (!expiresAt || new Date(expiresAt * 1000) > new Date()) {
          setUser(stored);
          if (expiresAt) scheduleExpiry(expiresAt);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    return () => { if (expiryTimer.current) clearTimeout(expiryTimer.current); };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const r = await fetch('/api/users?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!data.success) return false;
      setUser(data.user);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user: data.user, expiresAt: data.expiresAt }));
      if (data.expiresAt) scheduleExpiry(data.expiresAt);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
