import React, { createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { DataProvider, useData } from './DataContext';
import { Call } from '../data/types';

// Backward-compatible combined type — all pages using useApp() continue to work
interface AppContextType extends
  ReturnType<typeof useAuth>,
  ReturnType<typeof useData> {
  allCalls: Call[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppContextBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const data = useData();

  const allCalls: Call[] = data.state.calls;

  // Merge user from AuthContext into state so pages reading state.user still work
  const mergedState = { ...data.state, user: auth.user };

  return (
    <AppContext.Provider value={{ ...auth, ...data, state: mergedState, allCalls }}>
      {children}
    </AppContext.Provider>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <DataProvider>
      <AppContextBridge>
        {children}
      </AppContextBridge>
    </DataProvider>
  </AuthProvider>
);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
