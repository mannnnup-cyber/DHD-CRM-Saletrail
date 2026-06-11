import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

// ---------------------------------------------------------------------------
// Dashboard helper
// ---------------------------------------------------------------------------
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Opportunities types & rules (merged from opportunities.ts)
// ---------------------------------------------------------------------------
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Opportunity {
  id: string;
  rule: string;
  priority: Priority;
  title: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  actionUrl: string;
  ageMs: number;
  sourceId: string;
}

function hoursAgo(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function oppId(rule: string, sourceId: string) {
  return `${rule}::${sourceId}`;
}

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

    if (lead.contact_id) {
      const { data: existing } = await sb.from('interactions').select('id').eq('contact_id', lead.contact_id).limit(1).single();
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

    const { data: existing } = await sb.from('quotes').select('id').eq('deal_id', deal.id).limit(1).single();
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

const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// ---------------------------------------------------------------------------
// Organizations sub-handlers (merged from organizations.ts)
// ---------------------------------------------------------------------------
async function linkContact(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { contactId, organizationId, role, startedAt, endedAt, isPrimary = false } = req.body;
    if (!contactId || !organizationId) return res.status(400).json({ success: false, error: 'contactId and organizationId required' });
    if (contactId === organizationId) return res.status(400).json({ success: false, error: 'Cannot link contact to itself' });

    const { data: contact } = await supabase.from('contacts').select('id, name').eq('id', contactId).single();
    const { data: organization } = await supabase.from('contacts').select('id, name, contact_type').eq('id', organizationId).single();

    if (!contact || !organization) return res.status(404).json({ success: false, error: 'Contact or organization not found' });

    if (organization.contact_type !== 'organization') {
      await supabase.from('contacts').update({ contact_type: 'organization' }).eq('id', organizationId);
    }

    if (isPrimary) {
      await supabase.from('contact_organizations').update({ is_primary: false }).eq('contact_id', contactId);
    }

    const { data: existingLink } = await supabase
      .from('contact_organizations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('organization_id', organizationId)
      .eq('started_at', startedAt)
      .single();

    let result;
    if (existingLink) {
      const { data, error } = await supabase
        .from('contact_organizations')
        .update({ role: role || null, ended_at: endedAt || null, is_primary: isPrimary, updated_at: new Date().toISOString() })
        .eq('id', existingLink.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('contact_organizations')
        .insert({ contact_id: contactId, organization_id: organizationId, role: role || null, started_at: startedAt || null, ended_at: endedAt || null, is_primary: isPrimary })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    try {
      await supabase.from('interactions').insert({ contact_id: contactId, type: 'NOTE', subject: `Linked to organization: ${organization.name}${role ? ` as ${role}` : ''}`, content: `Added organizational affiliation${role ? ` with role: ${role}` : ''}${startedAt ? ` starting ${startedAt}` : ''}${endedAt ? ` until ${endedAt}` : ' (ongoing)'}`, metadata: { organizationId, organizationName: organization.name, role, startedAt, endedAt }, timestamp: new Date().toISOString() });
    } catch (interactionErr) {
      console.warn('[crm] Warning creating interaction:', interactionErr);
    }

    return res.status(200).json({ success: true, link: result });
  } catch (err: any) {
    console.error('[crm] linkContact error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

async function getOrganizations(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { contactId } = req.query as Record<string, string>;
    if (!contactId) return res.status(400).json({ success: false, error: 'contactId required' });

    const { data: links, error } = await supabase
      .from('contact_organizations')
      .select(`id, role, started_at, ended_at, is_primary, created_at, organization_id, contacts:organization_id ( id, name, email, phone, company, contact_type )`)
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: `Failed to fetch organizations: ${error.message}` });

    const organizations = (links || []).map((link: any) => ({
      linkId: link.id,
      id: link.contacts.id,
      name: link.contacts.name,
      email: link.contacts.email,
      phone: link.contacts.phone,
      company: link.contacts.company,
      role: link.role,
      startedAt: link.started_at,
      endedAt: link.ended_at,
      isPrimary: link.is_primary,
      isCurrent: !link.ended_at,
      status: link.ended_at ? 'ENDED' : 'ACTIVE'
    }));

    return res.status(200).json({ success: true, organizations, current: organizations.filter((o: any) => !o.endedAt), historical: organizations.filter((o: any) => o.endedAt) });
  } catch (err: any) {
    console.error('[crm] getOrganizations error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

async function getMembers(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { organizationId, current = 'true' } = req.query as Record<string, string>;
    if (!organizationId) return res.status(400).json({ success: false, error: 'organizationId required' });

    let query = supabase
      .from('contact_organizations')
      .select(`id, role, started_at, ended_at, is_primary, contacts:contact_id ( id, name, email, phone, company )`)
      .eq('organization_id', organizationId);

    if (current === 'true') {
      query = query.is('ended_at', null);
    }

    const { data: links, error } = await query.order('started_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: `Failed to fetch members: ${error.message}` });

    const members = (links || []).map((link: any) => ({
      memberId: link.contacts.id,
      linkId: link.id,
      name: link.contacts.name,
      email: link.contacts.email,
      phone: link.contacts.phone,
      company: link.contacts.company,
      role: link.role,
      startedAt: link.started_at,
      endedAt: link.ended_at,
      isPrimary: link.is_primary,
      status: link.ended_at ? 'ENDED' : 'ACTIVE'
    }));

    return res.status(200).json({ success: true, members, count: members.length, currentCount: members.filter((m: any) => !m.endedAt).length });
  } catch (err: any) {
    console.error('[crm] getMembers error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

async function unlinkContact(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { linkId } = req.body;
    if (!linkId) return res.status(400).json({ success: false, error: 'linkId required' });

    const { data: link, error: linkError } = await supabase
      .from('contact_organizations')
      .select(`id, contact_id, organization_id, role, contacts:contact_id (id, name), contacts_org:organization_id (id, name)`)
      .eq('id', linkId)
      .single();

    if (linkError || !link) return res.status(404).json({ success: false, error: 'Link not found' });

    const { error: updateError } = await supabase
      .from('contact_organizations')
      .update({ ended_at: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() })
      .eq('id', linkId);

    if (updateError) return res.status(500).json({ success: false, error: `Failed to unlink: ${updateError.message}` });

    try {
      await supabase.from('interactions').insert({ contact_id: link.contact_id, type: 'NOTE', subject: 'Unlinked from organization', content: `Removed affiliation with ${(link as any).contacts_org?.name || 'organization'}${link.role ? ` (was ${link.role})` : ''}`, metadata: { organizationId: link.organization_id, role: link.role, unlinkedAt: new Date().toISOString() }, timestamp: new Date().toISOString() });
    } catch (interactionErr) {
      console.warn('[crm] Warning creating unlink interaction:', interactionErr);
    }

    return res.status(200).json({ success: true, message: 'Contact unlinked from organization' });
  } catch (err: any) {
    console.error('[crm] unlinkContact error:', err);
    return res.status(500).json({ success: false, error: `Server error: ${err.message || 'Unknown error'}` });
  }
}

// ---------------------------------------------------------------------------
// Combined handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { target, action } = req.query as Record<string, string>;

  // ── Dashboard (no target, no action) ─────────────────────────────────────
  if (!target && !action) {
    const [
      contactsRes,
      interactionsRes,
      dealsRes,
      invoicesRes,
      emailsRes,
      recentActivityRes,
      callVolumeRes,
    ] = await Promise.all([
      supabase.from('contacts').select('source, status, total_revenue'),
      supabase.from('interactions').select('type, direction, created_at').gte('created_at', daysAgo(30)),
      supabase.from('deals').select('stage, value, created_at, updated_at'),
      supabase.from('invoices').select('status, amount, due_date'),
      supabase.from('emails').select('lead_score, category, read').gte('date', daysAgo(30)),
      supabase.from('interactions').select('type, direction, subject, content, created_at, contacts(name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('interactions').select('direction, created_at').eq('type', 'CALL').gte('created_at', daysAgo(14)),
    ]);

    const contacts = contactsRes.data || [];
    const interactions = interactionsRes.data || [];
    const deals = dealsRes.data || [];
    const invoices = invoicesRes.data || [];
    const emailsData = emailsRes.data || [];

    const totalContacts = contacts.length;
    const totalInteractions = interactions.length;

    const activeDeals = deals.filter((d: any) => d.stage !== 'Delivered' && d.stage !== 'Lost');
    const wonDeals = deals.filter((d: any) => d.stage === 'Delivered');
    const pipelineValue = activeDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    const totalRevenue = wonDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = invoices.filter((i: any) => i.status === 'pending' && i.due_date < today).length;
    const pendingInvoiceValue = invoices.filter((i: any) => i.status === 'pending' && i.due_date >= today).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    const overdueInvoiceValue = invoices.filter((i: any) => i.status === 'pending' && i.due_date < today).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

    const hotLeads = emailsData.filter((e: any) => (e.lead_score || 0) >= 80).length;
    const unreadEmails = emailsData.filter((e: any) => !e.read).length;

    const STAGES = ['New Lead', 'Consultation', 'Quote Sent', 'Design Review', 'In Production', 'Delivered', 'Lost'];
    const pipeline = STAGES.map(stage => {
      const stageDeals = deals.filter((d: any) => d.stage === stage);
      return { stage, count: stageDeals.length, value: stageDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0) };
    }).filter((s: any) => s.count > 0);

    const sourceMap: Record<string, number> = {};
    for (const c of contacts) {
      sourceMap[(c as any).source] = (sourceMap[(c as any).source] || 0) + 1;
    }
    const contactsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));

    const callRows = callVolumeRes.data || [];
    const callVolume = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86_400_000);
      const dateStr = d.toISOString().split('T')[0];
      const dayCalls = callRows.filter((r: any) => r.created_at.startsWith(dateStr));
      return {
        day: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).slice(0, 6),
        date: dateStr,
        total: dayCalls.length,
        inbound: dayCalls.filter((r: any) => r.direction === 'INBOUND').length,
        outbound: dayCalls.filter((r: any) => r.direction === 'OUTBOUND').length,
      };
    });

    const interactionsByType = {
      EMAIL: interactions.filter((i: any) => i.type === 'EMAIL').length,
      WHATSAPP: interactions.filter((i: any) => i.type === 'WHATSAPP').length,
      CALL: interactions.filter((i: any) => i.type === 'CALL').length,
      NOTE: interactions.filter((i: any) => i.type === 'NOTE').length,
    };

    const recentActivity = (recentActivityRes.data || []).map((r: any) => ({
      type: r.type,
      direction: r.direction,
      subject: r.subject || null,
      content: r.content ? String(r.content).slice(0, 80) : null,
      contactName: r.contacts?.name || null,
      timestamp: r.created_at,
    }));

    const revenueByMonth: Record<string, number> = {};
    for (const d of wonDeals) {
      const month = ((d as any).updated_at || (d as any).created_at || '').slice(0, 7);
      if (month) revenueByMonth[month] = (revenueByMonth[month] || 0) + (Number((d as any).value) || 0);
    }
    const now = new Date();
    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = d.toISOString().slice(0, 7);
      return { month: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }), revenue: revenueByMonth[key] || 0 };
    });

    return res.status(200).json({ kpis: { totalContacts, totalInteractions, activeDeals: activeDeals.length, pipelineValue, totalRevenue, overdueInvoices, overdueInvoiceValue, pendingInvoiceValue, hotLeads, unreadEmails, dealsWon: wonDeals.length }, pipeline, contactsBySource, callVolume, interactionsByType, recentActivity, monthlyRevenue });
  }

  // ── Opportunities ─────────────────────────────────────────────────────────
  if (target === 'opportunities') {
    if (action === 'dismiss' && req.method === 'POST') {
      const { ruleKey, sourceId, dismissedBy } = req.body || {};
      if (!ruleKey || !sourceId) return res.status(400).json({ error: 'ruleKey and sourceId required' });
      await supabase.from('dismissed_opportunities').insert({ rule_key: ruleKey, source_id: sourceId, dismissed_by: dismissedBy || null });
      return res.status(200).json({ success: true });
    }

    const { data: dismissedRows } = await supabase.from('dismissed_opportunities').select('rule_key, source_id');
    const dismissed = new Set<string>((dismissedRows || []).map((r: any) => oppId(r.rule_key, r.source_id)));

    const [emails, whatsapps, leads, deals, invoices, quotes, quotesDue] = await Promise.all([
      ruleEmailUnanswered(supabase, dismissed).catch(() => []),
      ruleWhatsappUnanswered(supabase, dismissed).catch(() => []),
      ruleLeadNoContact(supabase, dismissed).catch(() => []),
      ruleDealStale(supabase, dismissed).catch(() => []),
      ruleInvoiceOverdue(supabase, dismissed).catch(() => []),
      ruleQuoteExpiring(supabase, dismissed).catch(() => []),
      ruleQuoteOverdue(supabase, dismissed).catch(() => []),
    ]);

    const all: Opportunity[] = [...emails, ...whatsapps, ...leads, ...deals, ...invoices, ...quotes, ...quotesDue]
      .sort((a, b) => {
        const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pd !== 0) return pd;
        return b.ageMs - a.ageMs;
      });

    return res.status(200).json({ opportunities: all, count: all.length });
  }

  // ── Organizations ─────────────────────────────────────────────────────────
  if (target === 'organizations') {
    if (action === 'linkContact' && req.method === 'POST') return linkContact(req, res);
    if (action === 'getOrganizations' && req.method === 'GET') return getOrganizations(req, res);
    if (action === 'getMembers' && req.method === 'GET') return getMembers(req, res);
    if (action === 'unlinkContact' && req.method === 'POST') return unlinkContact(req, res);
    return res.status(404).json({ error: 'Action not found' });
  }

  return res.status(400).json({ error: 'Unknown target' });
}
