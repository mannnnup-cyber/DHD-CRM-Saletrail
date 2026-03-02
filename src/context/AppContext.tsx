import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Lead, Call, Deal, Task, Quote, Activity, AppSettings, CallType } from '../data/types';
import { TEAM_MEMBERS, INITIAL_SETTINGS, generateId, generateMockData } from '../data/store';
import { supabase, db } from '../lib/supabase';

export interface SyncedCall {
  rep: string;
  number: string;
  type: string;
  duration: string;
  date: string;
  time: string;
  name: string;
}

interface AppContextType {
  state: AppState;
  syncedCalls: SyncedCall[];
  allCalls: Call[];
  isSupabaseConnected: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addCall: (call: Omit<Call, 'id' | 'timestamp'>) => Promise<void>;
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  addTask: (task: Omit<Task, 'id' | 'completed'>) => Promise<void>;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt' | 'status'>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp' | 'userId'>) => void;
  setSyncedCalls: (calls: SyncedCall[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const convertSyncedToCall = (sc: SyncedCall, index: number): Call => {
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

  // Parse date from sheet format (DD/MM/YYYY or M/D/YYYY)
  let timestamp = new Date().toISOString();
  try {
    const dateParts = String(sc.date || '').split('/');
    if (dateParts.length === 3) {
      // Handle DD/MM/YYYY format
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
    repId: member?.id || repName, // Store rep name as fallback
    repName: repName, // Store actual rep name for matching
    contactId: '',
    contactName: String(sc.name || ''),
    contactPhone: String(sc.number || ''),
    type: callType,
    duration: parseInt(String(sc.duration || '0')) || 0,
    timestamp: timestamp,
    notes: String(sc.name || ''),
    source: 'SIM',
  } as any;
};

const INVALID_VALUES = ['', '?', 'VARIABLE', 'YOUR_NAME', '[call_number]', '[call_type]', '[call_duration]', '[call_contact_name]'];

const isValidSyncedCall = (sc: SyncedCall): boolean => {
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Supabase and load data
  useEffect(() => {
    const initSupabase = async () => {
      try {
        // Try to fetch data from Supabase
        const [leads, deals, calls, tasks, activities] = await Promise.all([
          db.getLeads().catch(() => []),
          db.getDeals().catch(() => []),
          db.getCalls().catch(() => []),
          db.getTasks().catch(() => []),
          db.getActivities().catch(() => [])
        ]);

        // If we have Supabase data, use it
        if (leads.length > 0 || deals.length > 0 || calls.length > 0) {
          console.log('✅ Connected to Supabase!');
          setIsSupabaseConnected(true);

          // Convert Supabase data to app format
          const convertedLeads: Lead[] = leads.map((l: any) => ({
            id: l.id,
            name: l.name,
            company: l.company,
            email: l.email,
            phone: l.phone,
            source: l.source,
            status: l.status,
            assignedTo: l.assigned_to,
            notes: l.notes,
            createdAt: l.created_at
          }));

          const convertedDeals: Deal[] = deals.map((d: any) => ({
            id: d.id,
            name: d.name,
            value: d.value,
            stage: d.stage,
            contactId: d.lead_id,
            repId: d.assigned_to,
            expectedCloseDate: d.expected_close_date,
            description: d.notes,
            createdAt: d.created_at,
            updatedAt: d.updated_at
          }));

          const convertedCalls: Call[] = calls.map((c: any) => ({
            id: c.id,
            type: c.type as CallType,
            contactPhone: c.phone_number,
            contactName: c.contact_name,
            duration: c.duration,
            notes: c.notes,
            repId: c.rep_id,
            timestamp: c.timestamp
          }));

          const convertedTasks: Task[] = tasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            dueDate: t.due_date,
            completed: t.completed,
            priority: t.priority,
            assignedTo: t.assigned_to,
            createdAt: t.created_at
          }));

          const convertedActivities: Activity[] = activities.map((a: any) => ({
            id: a.id,
            type: a.type,
            description: a.description,
            contactId: '',
            userId: a.user_id,
            timestamp: a.timestamp
          }));

          // Load Supabase data into state
          setState(prev => ({
            ...prev,
            leads: convertedLeads,
            deals: convertedDeals,
            calls: convertedCalls,
            tasks: convertedTasks,
            activities: convertedActivities
          }));
        } else {
          console.log('📦 No Supabase data found, using local storage');
        }
      } catch (error) {
        console.log('⚠️ Supabase not connected, using local storage');
      } finally {
        setIsLoading(false);
      }
    };

    initSupabase();
  }, []);

  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem('dhd_salestrail_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, user: null };
      }
    } catch (e) {}
    return {
      user: null,
      settings: INITIAL_SETTINGS,
      notifications: [],
      ...generateMockData()
    };
  });

  const [syncedCalls, setSyncedCallsState] = useState<SyncedCall[]>(() => {
    try {
      const saved = localStorage.getItem('dhd_synced_calls');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    const toSave = { ...state, user: null };
    localStorage.setItem('dhd_salestrail_state', JSON.stringify(toSave));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('dhd_synced_calls', JSON.stringify(syncedCalls));
  }, [syncedCalls]);

  // Merge mock calls + synced calls
  const allCalls: Call[] = [
    ...state.calls,
    ...syncedCalls.filter(isValidSyncedCall).map((sc, i) => convertSyncedToCall(sc, i))
  ];

  const login = (username: string, password: string): boolean => {
    const demoUsers = [
      { id: 'manager1', username: 'manager', password: 'manager123', name: 'Manager', email: 'manager@dhd.com', role: 'manager' as const },
      { id: 'rep1', username: 'keisha', password: 'keisha123', name: 'Keisha Brown', email: 'keisha@dhd.com', role: 'rep' as const },
      { id: 'rep2', username: 'andre', password: 'andre123', name: 'Andre Wilson', email: 'andre@dhd.com', role: 'rep' as const },
      { id: 'rep3', username: 'marcia', password: 'marcia123', name: 'Marcia Campbell', email: 'marcia@dhd.com', role: 'rep' as const },
      { id: 'rep4', username: 'devon', password: 'devon123', name: 'Devon Clarke', email: 'devon@dhd.com', role: 'rep' as const },
      { id: 'rep5', username: 'tanya', password: 'tanya123', name: 'Tanya Morrison', email: 'tanya@dhd.com', role: 'rep' as const },
    ];

    const user = demoUsers.find(u => u.username === username && u.password === password);
    if (user) {
      setState(prev => ({ ...prev, user }));
      return true;
    }
    return false;
  };

  const logout = () => setState(prev => ({ ...prev, user: null }));

  const addActivity = (activity: Omit<Activity, 'id' | 'timestamp' | 'userId'>) => {
    const newActivity: Activity = {
      ...activity,
      id: generateId(),
      timestamp: new Date().toISOString(),
      userId: state.user?.id || 'system'
    };
    setState(prev => ({
      ...prev,
      activities: [newActivity, ...(prev.activities || []).slice(0, 99)]
    }));
  };

  const addLead = async (lead: Omit<Lead, 'id' | 'createdAt'>) => {
    const newLead: Lead = {
      ...lead,
      id: generateId(),
      createdAt: new Date().toISOString()
    };

    const newDeal: Deal = {
      id: generateId(),
      name: `${lead.company} - ${(lead as any).natureCategory || lead.category || 'Project'}`,
      contactId: newLead.id,
      value: 0,
      stage: 'New Lead',
      repId: lead.assignedTo || state.user?.id || 'rep1',
      description: lead.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      leads: [newLead, ...prev.leads],
      deals: [newDeal, ...prev.deals]
    }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      try {
        await db.createLead({
          name: newLead.name,
          company: newLead.company,
          email: newLead.email,
          phone: newLead.phone,
          source: newLead.source,
          status: newLead.status,
          assigned_to: newLead.assignedTo,
          notes: newLead.notes
        });
        await db.createDeal({
          name: newDeal.name,
          value: newDeal.value,
          stage: newDeal.stage,
          assigned_to: newDeal.repId,
          notes: newDeal.description
        });
      } catch (e) {
        console.error('Error syncing lead to Supabase:', e);
      }
    }

    addActivity({
      contactId: newLead.id,
      type: 'Lead Created',
      description: `New lead: ${newLead.company}`
    });
  };

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setState(prev => ({
      ...prev,
      leads: prev.leads.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  };

  const deleteLead = (id: string) => {
    setState(prev => ({
      ...prev,
      leads: prev.leads.filter(l => l.id !== id),
      deals: prev.deals.filter(d => d.contactId !== id)
    }));
  };

  const addCall = async (call: Omit<Call, 'id' | 'timestamp'>) => {
    const newCall: Call = {
      ...call,
      id: generateId(),
      timestamp: new Date().toISOString()
    };
    setState(prev => ({ ...prev, calls: [newCall, ...prev.calls] }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      try {
        await db.createCall({
          type: newCall.type,
          phone_number: newCall.contactPhone,
          contact_name: newCall.contactName,
          duration: newCall.duration,
          rep_id: newCall.repId,
          notes: newCall.notes,
          timestamp: newCall.timestamp
        });
      } catch (e) {
        console.error('Error syncing call to Supabase:', e);
      }
    }

    addActivity({
      contactId: call.contactId || '',
      type: 'Call Logged',
      description: `${call.type} call logged`
    });
  };

  const addDeal = async (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDeal: Deal = {
      ...deal,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setState(prev => ({ ...prev, deals: [newDeal, ...prev.deals] }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      try {
        await db.createDeal({
          name: newDeal.name,
          value: newDeal.value,
          stage: newDeal.stage,
          lead_id: newDeal.contactId,
          assigned_to: newDeal.repId,
          expected_close_date: newDeal.expectedCloseDate,
          notes: newDeal.description
        });
      } catch (e) {
        console.error('Error syncing deal to Supabase:', e);
      }
    }

    addActivity({
      contactId: deal.contactId,
      type: 'Deal Created',
      description: `New deal: ${deal.name}`
    });
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)
    }));
  };

  const deleteDeal = (id: string) => {
    setState(prev => ({ ...prev, deals: prev.deals.filter(d => d.id !== id) }));
  };

  const addTask = async (task: Omit<Task, 'id' | 'completed'>) => {
    const newTask: Task = { ...task, id: generateId(), completed: false };
    setState(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      try {
        await db.createTask({
          title: newTask.title,
          description: newTask.description,
          due_date: newTask.dueDate,
          completed: newTask.completed,
          priority: newTask.priority,
          assigned_to: newTask.assignedTo
        });
      } catch (e) {
        console.error('Error syncing task to Supabase:', e);
      }
    }
  };

  const completeTask = (id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: true } : t)
    }));
    addActivity({ contactId: '', type: 'Task Completed', description: 'Task marked complete' });
  };

  const deleteTask = (id: string) => {
    setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  };

  const addQuote = (quote: Omit<Quote, 'id' | 'createdAt' | 'status'>) => {
    const newQuote: Quote = {
      ...quote,
      id: generateId(),
      status: 'Sent',
      createdAt: new Date().toISOString()
    };
    setState(prev => ({ ...prev, quotes: [newQuote, ...prev.quotes] }));
    addActivity({ contactId: '', type: 'Quote Sent', description: `Quote for $${quote.total.toLocaleString()} JMD` });
  };

  const updateSettings = (settings: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...settings } }));
  };

  const setSyncedCalls = (calls: SyncedCall[]) => {
    setSyncedCallsState(calls);
  };

  return (
    <AppContext.Provider value={{
      state, syncedCalls, allCalls,
      isSupabaseConnected, isLoading,
      login, logout,
      addLead, updateLead, deleteLead,
      addCall, addDeal, updateDeal, deleteDeal,
      addTask, completeTask, deleteTask,
      addQuote, updateSettings, addActivity, setSyncedCalls
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
