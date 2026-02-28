// Supabase Service - Hybrid approach for DHD CRM
// This service provides optional Supabase integration while maintaining localStorage fallback

import { supabase, db, type Lead, type Deal, type Call, type Task, type Activity, type Quote, type User } from './supabase';

// Flag to enable/disable Supabase sync
let supabaseEnabled = false;

export const enableSupabase = () => {
  supabaseEnabled = true;
  console.log('Supabase sync enabled');
};

export const isSupabaseEnabled = () => supabaseEnabled;

// Initialize Supabase and load data
export const initializeSupabase = async (): Promise<{
  leads: any[];
  deals: any[];
  calls: any[];
  tasks: any[];
  activities: any[];
  quotes: any[];
  users: any[];
  settings: any[];
}> => {
  try {
    // Try to fetch from Supabase
    const [leads, deals, calls, tasks, activities, quotes, users, settings] = await Promise.all([
      db.getLeads().catch(() => []),
      db.getDeals().catch(() => []),
      db.getCalls().catch(() => []),
      db.getTasks().catch(() => []),
      db.getActivities().catch(() => []),
      db.getQuotes().catch(() => []),
      db.getUsers().catch(() => []),
      db.getSettings().catch(() => [])
    ]);

    // If we have data from Supabase, use it
    if (leads.length > 0 || deals.length > 0 || calls.length > 0) {
      enableSupabase();
      console.log('Supabase connected successfully');
      return { leads, deals, calls, tasks, activities, quotes, users, settings };
    }

    console.log('No Supabase data found, using local storage');
    return { leads: [], deals: [], calls: [], tasks: [], activities: [], quotes: [], users: [], settings: [] };
  } catch (error) {
    console.error('Supabase initialization error:', error);
    return { leads: [], deals: [], calls: [], tasks: [], activities: [], quotes: [], users: [], settings: [] };
  }
};

// Sync functions - only work if Supabase is enabled
export const syncLead = async (lead: Partial<Lead>) => {
  if (!supabaseEnabled) return null;
  try {
    return await db.createLead(lead as any);
  } catch (error) {
    console.error('Error syncing lead:', error);
    return null;
  }
};

export const syncDeal = async (deal: Partial<Deal>) => {
  if (!supabaseEnabled) return null;
  try {
    return await db.createDeal(deal as any);
  } catch (error) {
    console.error('Error syncing deal:', error);
    return null;
  }
};

export const syncCall = async (call: Partial<Call>) => {
  if (!supabaseEnabled) return null;
  try {
    return await db.createCall(call as any);
  } catch (error) {
    console.error('Error syncing call:', error);
    return null;
  }
};

export const syncTask = async (task: Partial<Task>) => {
  if (!supabaseEnabled) return null;
  try {
    return await db.createTask(task as any);
  } catch (error) {
    console.error('Error syncing task:', error);
    return null;
  }
};

export const syncActivity = async (activity: Partial<Activity>) => {
  if (!supabaseEnabled) return null;
  try {
    return await db.createActivity(activity as any);
  } catch (error) {
    console.error('Error syncing activity:', error);
    return null;
  }
};

export const syncQuote = async (quote: Partial<Quote>) => {
  if (!supabaseEnabled) return null;
  try {
    return await db.createQuote(quote as any);
  } catch (error) {
    console.error('Error syncing quote:', error);
    return null;
  }
};

// Real-time subscriptions
export const subscribeToLeads = (callback: (payload: any) => void) => {
  if (!supabaseEnabled) return () => {};
  return db.subscribeToTable('leads', callback);
};

export const subscribeToDeals = (callback: (payload: any) => void) => {
  if (!supabaseEnabled) return () => {};
  return db.subscribeToTable('deals', callback);
};

export const subscribeToCalls = (callback: (payload: any) => void) => {
  if (!supabaseEnabled) return () => {};
  return db.subscribeToTable('calls', callback);
};

export const subscribeToTasks = (callback: (payload: any) => void) => {
  if (!supabaseEnabled) return () => {};
  return db.subscribeToTable('tasks', callback);
};

export default {
  initializeSupabase,
  enableSupabase,
  isSupabaseEnabled,
  syncLead,
  syncDeal,
  syncCall,
  syncTask,
  syncActivity,
  syncQuote,
  subscribeToLeads,
  subscribeToDeals,
  subscribeToCalls,
  subscribeToTasks
};
