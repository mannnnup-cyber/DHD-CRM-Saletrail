import React, { createContext, useContext, useState } from 'react';
import { User } from '../data/types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const DEMO_USERS: (User & { username: string; password: string })[] = [
  { id: 'manager1', username: 'manager', password: 'manager123', name: 'Manager', email: 'manager@dhd.com', role: 'manager' },
  { id: 'rep1', username: 'keisha', password: 'keisha123', name: 'Keisha Brown', email: 'keisha@dhd.com', role: 'rep' },
  { id: 'rep2', username: 'andre', password: 'andre123', name: 'Andre Wilson', email: 'andre@dhd.com', role: 'rep' },
  { id: 'rep3', username: 'marcia', password: 'marcia123', name: 'Marcia Campbell', email: 'marcia@dhd.com', role: 'rep' },
  { id: 'rep4', username: 'devon', password: 'devon123', name: 'Devon Clarke', email: 'devon@dhd.com', role: 'rep' },
  { id: 'rep5', username: 'tanya', password: 'tanya123', name: 'Tanya Morrison', email: 'tanya@dhd.com', role: 'rep' },
];

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (username: string, password: string): boolean => {
    const match = DEMO_USERS.find(u => u.username === username && u.password === password);
    if (match) {
      const { username: _u, password: _p, ...userRecord } = match;
      setUser(userRecord);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

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
