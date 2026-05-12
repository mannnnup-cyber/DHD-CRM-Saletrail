import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Opportunity {
  id: string;           // deterministic: rule + source record id
  rule: string;
  priority: Priority;
  title: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  actionUrl: string;
  ageMs: number;        // how old the underlying record is (ms)
  sourceId: string;     // id of the triggering record for dismiss
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hoursAgo(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function oppId(rule: string, sourceId: string) {
  return `${rule}::${sourceId}`;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// Rule 1 — Inbound email with no reply after 24 hrs
async function ruleEmailUnanswered(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: inbound } = await sb
    .from('interactions')
    .select('id, contact_id, subject, timestamp, metadata')
    .eq('type', 'EMAIL')
    .eq('direction', 'INBOUND')
    .lt('timestamp', cutoff)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (!inbound?.length) return [];

  // find which contact_ids have a subsequent outbound email
  const contactIds = [...new Set(inbound.map((r: any) => r.contact_id).filter(Boolean))];
  const { data: replied } = await sb
    .from('interactions')
    .select('contact_id')
    .eq('type', 'EMAIL')
    .eq('direction', 'OUTBOUND')
    .in('contact_id', contactIds);

  const repliedSet = new Set((replied || []).map((r: any) => r.contact_id));

  const opps: Opportunity[] = [];
  for (const row of inbound) {
    if (!row.contact_id || repliedSet.has(row.contact_id)) continue;
    const id = oppId('EMAIL_UNANSWERED', row.id);
    if (dismissed.has(id)) continue;

    const { data: contact } = await sb.from('contacts').select('name').eq('id', row.contact_id).single();
    const age = Date.now() - new Date(row.timestamp).getTime();

    opps.push({
      id,
      rule: 'EMAIL_UNANSWERED',
      priority: age > 48 * 3_600_000 ? 'CRITICAL' : 'HIGH',
      title: `Reply to email${contact?.name ? ` from ${contact.name}` : ''}`,
      description: `"${(row.subject || 'No subject').slice(0, 60)}" — unanswered for ${hoursAgo(age)}`,
      contactId: row.contact_id,
      contactName: contact?.name || null,
      actionUrl: '/email',
      ageMs: age,
      sourceId: row.id,
    });
  }
  return opps;
}

// Rule 2 — Inbound WhatsApp with no reply after 2 hrs
async function ruleWhatsappUnanswered(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { data: inbound } = await sb
    .from('interactions')
    .select('id, contact_id, content, timestamp')
    .eq('type', 'WHATSAPP')
    .eq('direction', 'INBOUND')
    .lt('timestamp', cutoff)
    .order('timestamp', { ascending: false })
    .limit(30);

  if (!inbound?.length) return [];

  const contactIds = [...new Set(inbound.map((r: any) => r.contact_id).filter(Boolean))];
  const { data: replied } = await sb
    .from('interactions')
    .select('contact_id')
    .eq('type', 'WHATSAPP')
    .eq('direction', 'OUTBOUND')
    .in('contact_id', contactIds);

  const repliedSet = new Set((replied || []).map((r: any) => r.contact_id));

  const opps: Opportunity[] = [];
  for (const row of inbound) {
    if (!row.contact_id || repliedSet.has(row.contact_id)) continue;
    const id = oppId('WHATSAPP_UNANSWERED', row.id);
    if (dismissed.has(id)) continue;

    const { data: contact } = await sb.from('contacts').select('name').eq('id', row.contact_id).single();
    const age = Date.now() - new Date(row.timestamp).getTime();

    opps.push({
      id,
      rule: 'WHATSAPP_UNANSWERED',
      priority: age > 6 * 3_600_000 ? 'CRITICAL' : 'HIGH',
      title: `Reply to WhatsApp${contact?.name ? ` from ${contact.name}` : ''}`,
      description: `"${(row.content || '').slice(0, 60)}" — unanswered for ${hoursAgo(age)}`,
      contactId: row.contact_id,
      contactName: contact?.name || null,
      actionUrl: '/whatsapp',
      ageMs: age,
      sourceId: row.id,
    });
  }
  return opps;
}

// Rule 3 — New lead with no contact after 1 hr
async function ruleLeadNoContact(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const cutoff = new Date(Date.now() - 1 * 3_600_000).toISOString();
  const { data: leads } = await sb
    .from('leads')
    .select('id, name, email, contact_id, created_at')
    .eq('status', 'new')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!leads?.length) return [];

  const opps: Opportunity[] = [];
  for (const lead of leads) {
    const id = oppId('LEAD_NO_CONTACT', lead.id);
    if (dismissed.has(id)) continue;

    // check if any interaction exists for this contact
    if (lead.contact_id) {
      const { data: existing } = await sb
        .from('interactions')
        .select('id')
        .eq('contact_id', lead.contact_id)
        .limit(1)
        .single();
      if (existing) continue;
    }

    const age = Date.now() - new Date(lead.created_at).getTime();
    opps.push({
      id,
      rule: 'LEAD_NO_CONTACT',
      priority: age > 4 * 3_600_000 ? 'CRITICAL' : 'HIGH',
      title: `Follow up with ${lead.name}`,
      description: `New lead — no contact logged for ${hoursAgo(age)}`,
      contactId: lead.contact_id || null,
      contactName: lead.name,
      actionUrl: lead.contact_id ? `/contacts/${lead.contact_id}` : '/leads',
      ageMs: age,
      sourceId: lead.id,
    });
  }
  return opps;
}

// Rule 4 — Deal stale in same stage >7 days
async function ruleDealStale(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const { data: deals } = await sb
    .from('deals')
    .select('id, name, stage, updated_at, contact_id')
    .lt('updated_at', cutoff)
    .not('stage', 'in', '("Delivered","Lost")')
    .order('updated_at', { ascending: true })
    .limit(20);

  if (!deals?.length) return [];

  const opps: Opportunity[] = [];
  for (const deal of deals) {
    const id = oppId('DEAL_STALE', deal.id);
    if (dismissed.has(id)) continue;

    const age = Date.now() - new Date(deal.updated_at).getTime();
    opps.push({
      id,
      rule: 'DEAL_STALE',
      priority: age > 14 * 24 * 3_600_000 ? 'HIGH' : 'MEDIUM',
      title: `Move deal: ${deal.name}`,
      description: `Stalled in "${deal.stage}" for ${hoursAgo(age)} — needs action`,
      contactId: deal.contact_id || null,
      contactName: null,
      actionUrl: '/pipeline',
      ageMs: age,
      sourceId: deal.id,
    });
  }
  return opps;
}

// Rule 5 — Invoice overdue
async function ruleInvoiceOverdue(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data: invoices } = await sb
    .from('invoices')
    .select('id, invoice_number, due_date, amount, contact_id')
    .eq('status', 'pending')
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(20);

  if (!invoices?.length) return [];

  const opps: Opportunity[] = [];
  for (const inv of invoices) {
    const id = oppId('INVOICE_OVERDUE', inv.id);
    if (dismissed.has(id)) continue;

    const age = Date.now() - new Date(inv.due_date).getTime();
    opps.push({
      id,
      rule: 'INVOICE_OVERDUE',
      priority: age > 7 * 24 * 3_600_000 ? 'CRITICAL' : 'HIGH',
      title: `Collect invoice ${inv.invoice_number}`,
      description: `Overdue by ${hoursAgo(age)} — JMD ${Number(inv.amount).toLocaleString()}`,
      contactId: inv.contact_id || null,
      contactName: null,
      actionUrl: '/invoices',
      ageMs: age,
      sourceId: inv.id,
    });
  }
  return opps;
}

// Rule 6 — Quote expiring within 2 days
async function ruleQuoteExpiring(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const now = new Date();
  const in2Days = new Date(now.getTime() + 2 * 24 * 3_600_000).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const { data: quotes } = await sb
    .from('quotes')
    .select('id, quote_number, valid_until, total_amount, contact_id')
    .eq('status', 'sent')
    .gte('valid_until', today)
    .lte('valid_until', in2Days)
    .order('valid_until', { ascending: true })
    .limit(20);

  if (!quotes?.length) return [];

  const opps: Opportunity[] = [];
  for (const q of quotes) {
    const id = oppId('QUOTE_EXPIRING', q.id);
    if (dismissed.has(id)) continue;

    const msLeft = new Date(q.valid_until).getTime() - Date.now();
    opps.push({
      id,
      rule: 'QUOTE_EXPIRING',
      priority: msLeft < 24 * 3_600_000 ? 'HIGH' : 'MEDIUM',
      title: `Follow up on quote ${q.quote_number}`,
      description: `Expires ${hoursAgo(-msLeft) === '0m' ? 'today' : `in ${hoursAgo(-msLeft)}`} — JMD ${Number(q.total_amount).toLocaleString()}`,
      contactId: q.contact_id || null,
      contactName: null,
      actionUrl: '/quotes',
      ageMs: -msLeft,
      sourceId: q.id,
    });
  }
  return opps;
}

// Rule 7 — Deal in "New Lead" >2 hrs, no quote sent
async function ruleQuoteOverdue(sb: any, dismissed: Set<string>): Promise<Opportunity[]> {
  const cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { data: deals } = await sb
    .from('deals')
    .select('id, name, contact_id, created_at')
    .eq('stage', 'New Lead')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(20);

  if (!deals?.length) return [];

  const opps: Opportunity[] = [];
  for (const deal of deals) {
    const id = oppId('QUOTE_OVERDUE', deal.id);
    if (dismissed.has(id)) continue;

    // check if a quote already exists for this deal
    const { data: existing } = await sb
      .from('quotes')
      .select('id')
      .eq('deal_id', deal.id)
      .limit(1)
      .single();
    if (existing) continue;

    const age = Date.now() - new Date(deal.created_at).getTime();
    opps.push({
      id,
      rule: 'QUOTE_OVERDUE',
      priority: age > 4 * 3_600_000 ? 'HIGH' : 'MEDIUM',
      title: `Send quote for: ${deal.name}`,
      description: `New Lead with no quote — ${hoursAgo(age)} without a quote sent`,
      contactId: deal.contact_id || null,
      contactName: null,
      actionUrl: '/quotes',
      ageMs: age,
      sourceId: deal.id,
    });
  }
  return opps;
}

// ---------------------------------------------------------------------------
// Priority sort order
// ---------------------------------------------------------------------------
const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// ---------------------------------------------------------------------------
// HTTP Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action } = req.query as Record<string, string>;

  // POST /api/opportunities?action=dismiss
  if (action === 'dismiss' && req.method === 'POST') {
    const { ruleKey, sourceId, dismissedBy } = req.body || {};
    if (!ruleKey || !sourceId) return res.status(400).json({ error: 'ruleKey and sourceId required' });

    await supabase.from('dismissed_opportunities').insert({
      rule_key: ruleKey,
      source_id: sourceId,
      dismissed_by: dismissedBy || null,
    });
    return res.status(200).json({ success: true });
  }

  // GET /api/opportunities — scan and return active list
  // Load all dismissed records first to avoid fetching dismissed items
  const { data: dismissedRows } = await supabase
    .from('dismissed_opportunities')
    .select('rule_key, source_id');

  const dismissed = new Set<string>(
    (dismissedRows || []).map((r: any) => oppId(r.rule_key, r.source_id))
  );

  // Run all rules in parallel — each rule handles its own errors gracefully
  const [emails, whatsapps, leads, deals, invoices, quotes, quotesDue] = await Promise.all([
    ruleEmailUnanswered(supabase, dismissed).catch(() => []),
    ruleWhatsappUnanswered(supabase, dismissed).catch(() => []),
    ruleLeadNoContact(supabase, dismissed).catch(() => []),
    ruleDealStale(supabase, dismissed).catch(() => []),
    ruleInvoiceOverdue(supabase, dismissed).catch(() => []),
    ruleQuoteExpiring(supabase, dismissed).catch(() => []),
    ruleQuoteOverdue(supabase, dismissed).catch(() => []),
  ]);

  const all: Opportunity[] = [
    ...emails, ...whatsapps, ...leads, ...deals,
    ...invoices, ...quotes, ...quotesDue,
  ].sort((a, b) => {
    const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pd !== 0) return pd;
    return b.ageMs - a.ageMs; // older = more urgent within same priority
  });

  return res.status(200).json({ opportunities: all, count: all.length });
}
