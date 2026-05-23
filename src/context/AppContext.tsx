import React, { createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { SyncProvider, useSync, SyncedCall } from './SyncContext';
import { DataProvider, useData } from './DataContext';
import { Call } from '../data/types';

// Re-export SyncedCall so existing imports from AppContext still work
export type { SyncedCall };

// Backward-compatible combined type — all pages using useApp() continue to work
interface AppContextType extends
  ReturnType<typeof useAuth>,
  ReturnType<typeof useSync>,
  ReturnType<typeof useData> {
  allCalls: Call[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppContextBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const sync = useSync();
  const data = useData();

  const allCalls: Call[] = [
    ...data.state.calls,
    ...sync.syncedCalls.filter(sync.isValidSyncedCall).map((sc, i) => sync.convertSyncedToCall(sc, i))
  ];

  // Merge user from AuthContext into state so pages reading state.user still work
  const mergedState = { ...data.state, user: auth.user };

  return (
    <AppContext.Provider value={{ ...auth, ...sync, ...data, state: mergedState, allCalls }}>
      {children}
    </AppContext.Provider>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <SyncProvider>
      <DataProvider>
        <AppContextBridge>
          {children}
        </AppContextBridge>
      </DataProvider>
    </SyncProvider>
  </AuthProvider>
);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
