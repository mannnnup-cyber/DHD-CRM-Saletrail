import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vatsonbvjkyzxqrnderr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHNvbmJ2amt5enhxcm5kZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTEzMzksImV4cCI6MjA4Nzg4NzMzOX0.Uty-mze63w9ecdE36JLvIM9A0NaPA8FyWqGyMCa944A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'sales_rep';
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: 'New Lead' | 'Consultation' | 'Quote Sent' | 'Design Review' | 'In Production' | 'Delivered' | 'Lost';
  lead_id?: string;
  assigned_to?: string;
  expected_close_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  type: 'Incoming' | 'Outgoing' | 'WhatsApp';
  phone_number?: string;
  contact_name?: string;
  duration: number;
  notes?: string;
  rep_id?: string;
  timestamp: string;
  recording_url?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  type: 'call' | 'deal_moved' | 'quote_created' | 'task_completed' | 'lead_created' | 'note_added';
  description: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  deal_id?: string;
  lead_id?: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  valid_until?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  quote_id?: string;
  deal_id?: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date?: string;
  paid_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// API Functions
export const db = {
  // Users
  async getUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data;
  },

  async createUser(user: Partial<User>) {
    const { data, error } = await supabase.from('users').insert(user).select();
    if (error) throw error;
    return data;
  },

  // Leads
  async getLeads() {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createLead(lead: Partial<Lead>) {
    const { data, error } = await supabase.from('leads').insert(lead).select();
    if (error) throw error;
    return data;
  },

  async updateLead(id: string, lead: Partial<Lead>) {
    const { data, error } = await supabase.from('leads').update(lead).eq('id', id).select();
    if (error) throw error;
    return data;
  },

  async deleteLead(id: string) {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw error;
  },

  // Deals
  async getDeals() {
    const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createDeal(deal: Partial<Deal>) {
    const { data, error } = await supabase.from('deals').insert(deal).select();
    if (error) throw error;
    return data;
  },

  async updateDeal(id: string, deal: Partial<Deal>) {
    const { data, error } = await supabase.from('deals').update(deal).eq('id', id).select();
    if (error) throw error;
    return data;
  },

  async deleteDeal(id: string) {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) throw error;
  },

  // Calls
  async getCalls() {
    const { data, error } = await supabase.from('calls').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createCall(call: Partial<Call>) {
    const { data, error } = await supabase.from('calls').insert(call).select();
    if (error) throw error;
    return data;
  },

  // Tasks
  async getTasks() {
    const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createTask(task: Partial<Task>) {
    const { data, error } = await supabase.from('tasks').insert(task).select();
    if (error) throw error;
    return data;
  },

  async updateTask(id: string, task: Partial<Task>) {
    const { data, error } = await supabase.from('tasks').update(task).eq('id', id).select();
    if (error) throw error;
    return data;
  },

  async deleteTask(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  // Activities
  async getActivities(limit = 50) {
    const { data, error } = await supabase.from('activities').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  async createActivity(activity: Partial<Activity>) {
    const { data, error } = await supabase.from('activities').insert(activity).select();
    if (error) throw error;
    return data;
  },

  // Quotes
  async getQuotes() {
    const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createQuote(quote: Partial<Quote>) {
    const { data, error } = await supabase.from('quotes').insert(quote).select();
    if (error) throw error;
    return data;
  },

  // Invoices
  async getInvoices() {
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createInvoice(invoice: Partial<Invoice>) {
    const { data, error } = await supabase.from('invoices').insert(invoice).select();
    if (error) throw error;
    return data;
  },

  // Settings
  async getSettings() {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    return data;
  },

  async updateSetting(key: string, value: string) {
    const { data, error } = await supabase.from('settings').update({ value }).eq('key', key).select();
    if (error) throw error;
    return data;
  },

  // Real-time subscriptions
  subscribeToTable(table: string, callback: (payload: any) => void) {
    return supabase.channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }
};

export default db;
