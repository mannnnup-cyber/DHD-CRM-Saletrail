import React, { createContext, useContext, useState, useEffect } from 'react';
import { Call, CallType } from '../data/types';
import { TEAM_MEMBERS } from '../data/store';

export interface SyncedCall {
  rep: string;
  number: string;
  type: string;
  duration: string;
  date: string;
  time: string;
  name: string;
}

interface SyncContextType {
  syncedCalls: SyncedCall[];
  isSupabaseConnected: boolean;
  setIsSupabaseConnected: (v: boolean) => void;
  setSyncedCalls: (calls: SyncedCall[]) => void;
  convertSyncedToCall: (sc: SyncedCall, index: number) => Call;
  isValidSyncedCall: (sc: SyncedCall) => boolean;
}

const INVALID_VALUES = ['', '?', 'VARIABLE', 'YOUR_NAME', '[call_number]', '[call_type]', '[call_duration]', '[call_contact_name]'];

export const isValidSyncedCall = (sc: SyncedCall): boolean => {
  const rep = String(sc.rep || '').trim();
  const number = String(sc.number || '').trim();
  const type = String(sc.type || '').trim();
  return (
    !INVALID_VALUES.includes(rep) &&
    !INVALID_VALUES.includes(number) &&
    !INVALID_VALUES.includes(type) &&
    rep !== '' &&
    number !== ''
  );
};

export const convertSyncedToCall = (sc: SyncedCall, index: number): Call => {
  const repName = String(sc.rep || '').trim();
  const member = TEAM_MEMBERS.find(t =>
    t.name.toLowerCase().includes(repName.toLowerCase()) ||
    repName.toLowerCase().includes(t.name.toLowerCase().split(' ')[0])
  );

  const typeStr = String(sc.type || '').toLowerCase();
  let callType: CallType = 'Outgoing';
  if (typeStr.includes('incoming')) callType = 'Incoming';
  else if (typeStr.includes('missed')) callType = 'Missed';
  else if (typeStr.includes('whatsapp')) callType = 'WhatsApp';

  let timestamp = new Date().toISOString();
  try {
    const dateParts = String(sc.date || '').split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1;
      const year = parseInt(dateParts[2]);
      const timeParts = String(sc.time || '').split(':');
      const d = new Date(year, month, day,
        parseInt(timeParts[0] || '0'),
        parseInt(timeParts[1] || '0'),
        parseInt(timeParts[2] || '0')
      );
      if (!isNaN(d.getTime())) timestamp = d.toISOString();
    }
  } catch (e) {}

  return {
    id: `synced_${index}_${sc.number}_${sc.date}_${sc.time}`,
    repId: member?.id || repName,
    repName: repName,
    contactId: '',
    contactName: String(sc.name || ''),
    contactPhone: String(sc.number || ''),
    type: callType,
    duration: parseInt(String(sc.duration || '0')) || 0,
    timestamp,
    notes: String(sc.name || ''),
    source: 'SIM',
  } as any;
};

export const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  const [syncedCalls, setSyncedCallsState] = useState<SyncedCall[]>(() => {
    try {
      const saved = localStorage.getItem('dhd_synced_calls');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem('dhd_synced_calls', JSON.stringify(syncedCalls));
  }, [syncedCalls]);

  const setSyncedCalls = (calls: SyncedCall[]) => setSyncedCallsState(calls);

  return (
    <SyncContext.Provider value={{
      syncedCalls,
      isSupabaseConnected,
      setIsSupabaseConnected,
      setSyncedCalls,
      convertSyncedToCall,
      isValidSyncedCall,
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
};
