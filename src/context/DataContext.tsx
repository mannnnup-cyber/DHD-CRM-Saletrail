import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Lead, Call, Deal, Task, Quote, Activity, AppSettings, Invoice } from '../data/types';

import { INITIAL_SETTINGS, generateId, generateMockData } from '../data/store';
import { db, supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { rowToLead, rowToDeal, rowToCall, rowToTask, rowToActivity } from '../lib/adapters';
import { useAuth } from './AuthContext';
import { useSync } from './SyncContext';

interface DataContextType {
  state: AppState;
  isLoading: boolean;
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
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  convertQuoteToInvoice: (quoteId: string) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp' | 'userId'>) => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isSupabaseConnected, setIsSupabaseConnected } = useSync();
  const [isLoading, setIsLoading] = useState(true);

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
      invoices: [],
      ...generateMockData()
    };
  });

  // Persist to localStorage on every state change
  useEffect(() => {
    const toSave = { ...state, user: null };
    localStorage.setItem('dhd_salestrail_state', JSON.stringify(toSave));
  }, [state]);

  // Load from Supabase on startup
  useEffect(() => {
    const init = async () => {
      try {
        const [leads, deals, calls, tasks, activities] = await Promise.all([
          db.getLeads().catch(() => []),
          db.getDeals().catch(() => []),
          db.getCalls().catch(() => []),
          db.getTasks().catch(() => []),
          db.getActivities().catch(() => [])
        ]);

        if (leads.length > 0 || deals.length > 0 || calls.length > 0) {
          logger.info('✅ Connected to Supabase!');
          setIsSupabaseConnected(true);
          setState(prev => ({
            ...prev,
            leads: leads.map((l: any) => rowToLead(l)),
            deals: deals.map((d: any) => rowToDeal(d)),
            calls: calls.map((c: any) => rowToCall(c)),
            tasks: tasks.map((t: any) => rowToTask(t)),
            activities: activities.map((a: any) => rowToActivity(a))
          }));
        } else {
          logger.info('📦 No Supabase data found, using local storage');
        }
      } catch {
        logger.warn('⚠️ Supabase not connected, using local storage');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const addActivity = (activity: Omit<Activity, 'id' | 'timestamp' | 'userId'>) => {
    const newActivity: Activity = {
      ...activity,
      id: generateId(),
      timestamp: new Date().toISOString(),
      userId: user?.id || 'system'
    };
    setState(prev => ({
      ...prev,
      activities: [newActivity, ...(prev.activities || []).slice(0, 99)]
    }));
  };

  const addLead = async (lead: Omit<Lead, 'id' | 'createdAt'>) => {
    const newLead: Lead = { ...lead, id: generateId(), createdAt: new Date().toISOString() };
    const newDeal: Deal = {
      id: generateId(),
      name: `${lead.company} - ${(lead as any).natureCategory || lead.category || 'Project'}`,
      contactId: newLead.id,
      value: 0,
      stage: 'New Lead',
      repId: lead.assignedTo || user?.id || 'rep1',
      description: lead.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setState(prev => ({ ...prev, leads: [newLead, ...prev.leads], deals: [newDeal, ...prev.deals] }));

    if (isSupabaseConnected) {
      try {
        await db.createLead({
          name: newLead.name, company: newLead.company, email: newLead.email,
          phone: newLead.phone, source: newLead.source,
          status: (String(newLead.status || '').toLowerCase() as any),
          assigned_to: newLead.assignedTo, notes: (newLead as any).notes || newLead.description || ''
        });
        await db.createDeal({ name: newDeal.name, value: newDeal.value, stage: newDeal.stage, assigned_to: newDeal.repId, notes: newDeal.description });
      } catch (e) { logger.error('Error syncing lead to Supabase:', e); }
    }
    addActivity({ contactId: newLead.id, type: 'Lead Created', description: `New lead: ${newLead.company}` });
  };

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setState(prev => ({ ...prev, leads: prev.leads.map(l => l.id === id ? { ...l, ...updates } : l) }));
  };

  const deleteLead = (id: string) => {
    setState(prev => ({ ...prev, leads: prev.leads.filter(l => l.id !== id), deals: prev.deals.filter(d => d.contactId !== id) }));
  };

  const addCall = async (call: Omit<Call, 'id' | 'timestamp'>) => {
    const newCall: Call = { ...call, id: generateId(), timestamp: new Date().toISOString() };
    setState(prev => ({ ...prev, calls: [newCall, ...prev.calls] }));

    if (isSupabaseConnected) {
      try {
        // Resolve contact identity for this call
        let contactId: string | null = null;
        const contactPhone = (newCall as any).contactPhone;
        const contactName = (newCall as any).contactName;
        if (contactPhone || contactName) {
          try {
            const r = await fetch('/api/contacts?action=resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: contactName || contactPhone, phone: contactPhone, source: 'MANUAL' })
            });
            if (r.ok) {
              const resolved = await r.json();
              contactId = resolved.id ?? null;
            }
          } catch { /* non-fatal */ }
        }

        const dbCallType = newCall.type === 'Missed' ? 'Incoming' : newCall.type;
        const [callRows] = await Promise.all([
          db.createCall({
            type: dbCallType as any,
            phone_number: contactPhone,
            contact_name: contactName,
            duration: newCall.duration, rep_id: newCall.repId,
            notes: newCall.notes, timestamp: newCall.timestamp,
            ...(contactId ? { contact_id: contactId } : {})
          } as any),
        ]);

        // Log to interactions table
        if (contactId) {
          await supabase.from('interactions').insert({
            contact_id: contactId,
            type: 'CALL',
            direction: newCall.type === 'Incoming' || newCall.type === 'Missed' ? 'INBOUND' : 'OUTBOUND',
            subject: `${newCall.type} call`,
            content: newCall.notes || '',
            metadata: { call_id: callRows?.[0]?.id, duration: newCall.duration },
            timestamp: newCall.timestamp,
          });
        }
      } catch (e) { logger.error('Error syncing call to Supabase:', e); }
    }
    addActivity({ contactId: call.contactId || '', type: 'Call Logged', description: `${call.type} call logged` });
  };

  const addDeal = async (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDeal: Deal = { ...deal, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setState(prev => ({ ...prev, deals: [newDeal, ...prev.deals] }));

    if (isSupabaseConnected) {
      try {
        await db.createDeal({ name: newDeal.name, value: newDeal.value, stage: newDeal.stage, lead_id: newDeal.contactId, assigned_to: newDeal.repId, expected_close_date: newDeal.expectedCloseDate, notes: newDeal.description });
      } catch (e) { logger.error('Error syncing deal to Supabase:', e); }
    }
    addActivity({ contactId: deal.contactId, type: 'Deal Created', description: `New deal: ${deal.name}` });
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setState(prev => ({ ...prev, deals: prev.deals.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d) }));
  };

  const deleteDeal = (id: string) => {
    setState(prev => ({ ...prev, deals: prev.deals.filter(d => d.id !== id) }));
  };

  const addTask = async (task: Omit<Task, 'id' | 'completed'>) => {
    const newTask: Task = { ...task, id: generateId(), completed: false };
    setState(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));

    if (isSupabaseConnected) {
      try {
        await db.createTask({ title: newTask.title, description: (newTask as any).description || '', due_date: newTask.dueDate, completed: newTask.completed, priority: newTask.priority, assigned_to: (newTask as any).assignedTo || newTask.repId });
      } catch (e) { logger.error('Error syncing task to Supabase:', e); }
    }
  };

  const completeTask = (id: string) => {
    setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: true } : t) }));
    addActivity({ contactId: '', type: 'Task Completed', description: 'Task marked complete' });
  };

  const deleteTask = (id: string) => {
    setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  };

  const addQuote = (quote: Omit<Quote, 'id' | 'createdAt' | 'status'>) => {
    const newQuote: Quote = { ...quote, id: generateId(), status: 'Sent', createdAt: new Date().toISOString() };
    setState(prev => ({ ...prev, quotes: [newQuote, ...prev.quotes] }));
    addActivity({ contactId: '', type: 'Quote Sent', description: `Quote for $${quote.total.toLocaleString()} JMD` });
  };

  const updateQuote = (id: string, updates: Partial<Quote>) => {
    setState(prev => ({ ...prev, quotes: prev.quotes.map(q => q.id === id ? { ...q, ...updates } : q) }));
  };

  const convertQuoteToInvoice = (quoteId: string) => {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const invoice: Invoice = {
      id: generateId(),
      quoteId: quote.id,
      dealId: quote.dealId,
      items: quote.items,
      total: quote.total,
      gct: quote.gct,
      grandTotal: quote.grandTotal,
      status: 'Unpaid',
      createdAt: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
      repId: quote.repId,
    };

    setState(prev => ({
      ...prev,
      quotes: prev.quotes.map(q => q.id === quoteId ? { ...q, status: 'Approved' } : q),
      invoices: [invoice, ...(prev.invoices || [])],
      deals: prev.deals.map(d => d.id === quote.dealId ? { ...d, stage: 'In Production', updatedAt: new Date().toISOString() } : d)
    }));

    addActivity({ contactId: '', type: 'Invoice Created', description: `Invoice for JMD ${invoice.grandTotal.toLocaleString()}` });
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setState(prev => ({
      ...prev,
      invoices: (prev.invoices || []).map(inv => inv.id === id ? { ...inv, ...updates } : inv)
    }));
  };

  const updateSettings = (settings: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...settings } }));
  };

  return (
    <DataContext.Provider value={{
      state, isLoading,
      addLead, updateLead, deleteLead,
      addCall, addDeal, updateDeal, deleteDeal,
      addTask, completeTask, deleteTask,
      addQuote, updateQuote, convertQuoteToInvoice,
      updateInvoice, updateSettings, addActivity,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
