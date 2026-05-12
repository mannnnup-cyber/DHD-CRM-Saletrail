import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const [
    contactsRes,
    interactionsRes,
    dealsRes,
    invoicesRes,
    emailsRes,
    recentActivityRes,
    callVolumeRes,
  ] = await Promise.all([
    // Contact counts by source
    supabase.from('contacts').select('source, status, total_revenue'),

    // Interaction counts by type/direction for last 30 days
    supabase
      .from('interactions')
      .select('type, direction, created_at')
      .gte('created_at', daysAgo(30)),

    // All non-closed deals
    supabase
      .from('deals')
      .select('stage, value, created_at, updated_at'),

    // Invoices
    supabase
      .from('invoices')
      .select('status, amount, due_date'),

    // Email lead scores
    supabase
      .from('emails')
      .select('lead_score, category, read')
      .gte('date', daysAgo(30)),

    // Recent 20 interactions for activity feed
    supabase
      .from('interactions')
      .select('type, direction, subject, content, created_at, contacts(name)')
      .order('created_at', { ascending: false })
      .limit(20),

    // Call volume: interactions of type CALL for last 14 days
    supabase
      .from('interactions')
      .select('direction, created_at')
      .eq('type', 'CALL')
      .gte('created_at', daysAgo(14)),
  ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const contacts = contactsRes.data || [];
  const interactions = interactionsRes.data || [];
  const deals = dealsRes.data || [];
  const invoices = invoicesRes.data || [];
  const emailsData = emailsRes.data || [];

  const totalContacts = contacts.length;
  const totalInteractions = interactions.length;

  const activeDeals = deals.filter(d => d.stage !== 'Delivered' && d.stage !== 'Lost');
  const wonDeals = deals.filter(d => d.stage === 'Delivered');
  const pipelineValue = activeDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const totalRevenue = wonDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);

  const today = new Date().toISOString().split('T')[0];
  const overdueInvoices = invoices.filter(i => i.status === 'pending' && i.due_date < today).length;
  const pendingInvoiceValue = invoices
    .filter(i => i.status === 'pending' && i.due_date >= today)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const overdueInvoiceValue = invoices
    .filter(i => i.status === 'pending' && i.due_date < today)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const hotLeads = emailsData.filter(e => (e.lead_score || 0) >= 80).length;
  const unreadEmails = emailsData.filter(e => !e.read).length;

  // ── Pipeline breakdown ────────────────────────────────────────────────────
  const STAGES = ['New Lead', 'Consultation', 'Quote Sent', 'Design Review', 'In Production', 'Delivered', 'Lost'];
  const pipeline = STAGES.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((s, d) => s + (Number(d.value) || 0), 0),
    };
  }).filter(s => s.count > 0);

  // ── Contacts by source ────────────────────────────────────────────────────
  const sourceMap: Record<string, number> = {};
  for (const c of contacts) {
    sourceMap[c.source] = (sourceMap[c.source] || 0) + 1;
  }
  const contactsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));

  // ── Call volume (14-day) ──────────────────────────────────────────────────
  const callRows = callVolumeRes.data || [];
  const callVolume = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000);
    const dateStr = d.toISOString().split('T')[0];
    const dayCalls = callRows.filter(r => r.created_at.startsWith(dateStr));
    return {
      day: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).slice(0, 6),
      date: dateStr,
      total: dayCalls.length,
      inbound: dayCalls.filter(r => r.direction === 'INBOUND').length,
      outbound: dayCalls.filter(r => r.direction === 'OUTBOUND').length,
    };
  });

  // ── Interaction breakdown (last 30 days) ──────────────────────────────────
  const interactionsByType = {
    EMAIL: interactions.filter(i => i.type === 'EMAIL').length,
    WHATSAPP: interactions.filter(i => i.type === 'WHATSAPP').length,
    CALL: interactions.filter(i => i.type === 'CALL').length,
    NOTE: interactions.filter(i => i.type === 'NOTE').length,
  };

  // ── Recent activity feed ──────────────────────────────────────────────────
  const recentActivity = (recentActivityRes.data || []).map((r: any) => ({
    type: r.type,
    direction: r.direction,
    subject: r.subject || null,
    content: r.content ? String(r.content).slice(0, 80) : null,
    contactName: r.contacts?.name || null,
    timestamp: r.created_at,
  }));

  // ── Revenue by month (last 6 months from closed deals) ────────────────────
  const revenueByMonth: Record<string, number> = {};
  for (const d of wonDeals) {
    const month = (d.updated_at || d.created_at || '').slice(0, 7); // YYYY-MM
    if (month) revenueByMonth[month] = (revenueByMonth[month] || 0) + (Number(d.value) || 0);
  }
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = d.toISOString().slice(0, 7);
    return {
      month: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      revenue: revenueByMonth[key] || 0,
    };
  });

  return res.status(200).json({
    kpis: {
      totalContacts,
      totalInteractions,
      activeDeals: activeDeals.length,
      pipelineValue,
      totalRevenue,
      overdueInvoices,
      overdueInvoiceValue,
      pendingInvoiceValue,
      hotLeads,
      unreadEmails,
      dealsWon: wonDeals.length,
    },
    pipeline,
    contactsBySource,
    callVolume,
    interactionsByType,
    recentActivity,
    monthlyRevenue,
  });
}
