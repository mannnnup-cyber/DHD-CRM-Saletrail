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

  // ── Team stats ────────────────────────────────────────────────────────────
  if (target === 'team') {
    if (action === 'stats') return getTeamStats(req, res);
    return res.status(404).json({ error: 'Action not found' });
  }

  // ── Automation ────────────────────────────────────────────────────────────
  if (target === 'automation') {
    if (action === 'run') {
      const secret = (req.headers['x-cron-secret'] as string) || (req.query.secret as string);
      const configured = process.env.CRON_SECRET;
      if (configured && secret !== configured) return res.status(401).json({ error: 'Unauthorized' });
      return runAutomation(req, res);
    }
    if (action === 'getStatus') return getAutomationStatus(req, res);
    if (action === 'toggleRule' && req.method === 'POST') return toggleAutomationRule(req, res);
    return res.status(404).json({ error: 'Action not found' });
  }

  // ── Organizations ─────────────────────────────────────────────────────────
  if (target === 'organizations') {
    if (action === 'linkContact' && req.method === 'POST') return linkContact(req, res);
    if (action === 'getOrganizations' && req.method === 'GET') return getOrganizations(req, res);
    if (action === 'getMembers' && req.method === 'GET') return getMembers(req, res);
    if (action === 'unlinkContact' && req.method === 'POST') return unlinkContact(req, res);
    return res.status(404).json({ error: 'Action not found' });
  }

  // Analyze actions (merged from analyze.ts)
  if (target === 'analyze') {
    if (action === 'analyzeCall') return handleAnalyzeCall(req, res);
    if (action === 'batchAnalyze') return handleBatchAnalyze(req, res);
    if (action === 'getMetrics') return handleGetMetrics(req, res);
    return res.status(404).json({ error: 'Action not found' });
  }

  return res.status(400).json({ error: 'Unknown target' });
}

// ---------------------------------------------------------------------------
// Analyze helpers (merged from analyze.ts)
// Uses service role key for call_insights write access
// ---------------------------------------------------------------------------
const _adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || '';
const _adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = _adminUrl && _adminKey ? createClient(_adminUrl, _adminKey) : null;

function analyzeBasicSentiment(text: string): { sentiment: string; score: number } {
  if (!text?.trim()) return { sentiment: 'NEUTRAL', score: 0.5 };
  const positivePatterns = [/\b(love|great|amazing|excellent|perfect|fantastic|wonderful|awesome|best)\b/gi, /\b(definitely|absolutely|for sure|agreed)\b/gi, /\b(move forward|let's proceed|next step|sign up|excited)\b/gi, /\b(thanks|thank you|appreciate)\b/gi];
  const negativePatterns = [/\b(no|don't|doesn't|won't|can't|not|never|hate|bad|terrible|awful)\b/gi, /\b(problem|issue|concern|worried|hesitant|doubt|unsure)\b/gi, /\b(expensive|too much|too costly|over budget)\b/gi, /\b(competitor|alternative|other option|elsewhere)\b/gi];
  let pos = 0, neg = 0;
  positivePatterns.forEach(p => { const m = text.match(p); if (m) pos += m.length; });
  negativePatterns.forEach(p => { const m = text.match(p); if (m) neg += m.length; });
  const total = pos + neg;
  if (total === 0) return { sentiment: 'NEUTRAL', score: 0.5 };
  if (pos > neg) return { sentiment: 'POSITIVE', score: Math.min(pos / total, 1.0) };
  if (neg > pos) return { sentiment: 'NEGATIVE', score: Math.min(neg / total, 1.0) };
  return { sentiment: 'NEUTRAL', score: 0.5 };
}

function extractKeywords(text: string): string[] {
  const kw: string[] = [];
  if (/\b(concern|worried|hesitant|not sure|but what about|problem|issue|doubt)\b/i.test(text)) kw.push('objection_handling');
  if (/\b(let's move forward|let's proceed|when can we start|ready to go|sign me up|excited to start)\b/i.test(text)) kw.push('closing_signal');
  if (/\b(price|cost|budget|invest|investment|expensive|value|roi|affordable|payment|pricing)\b/i.test(text)) kw.push('price_discussion');
  if (/\b(challenge|problem|pain|biggest issue|what's important|tell me about|help me understand|need|requirement)\b/i.test(text)) kw.push('needs_discovery');
  if (/\b(follow up|next step|next time|schedule|calendar|meeting|call|demo|email|send you)\b/i.test(text)) kw.push('next_steps_set');
  if (/\b(call now|sign up|register|apply|book|purchase|buy|order|claim|get started)\b/i.test(text)) kw.push('call_to_action');
  if (/\b(trust|confident|partnership|working together|collaboration|team|together)\b/i.test(text)) kw.push('relationship_building');
  if (/\b(competitor|alternative|other|different|similar|elsewhere|other company)\b/i.test(text)) kw.push('competitor_mention');
  return kw;
}

async function handleAnalyzeCall(req: VercelRequest, res: VercelResponse) {
  const db = supabaseAdmin;
  if (!db) return res.status(503).json({ error: 'Supabase admin not configured' });
  const { call_id, user_id, org_id } = req.body;
  if (!call_id || !user_id || !org_id) return res.status(400).json({ success: false, error: 'Missing call_id, user_id, or org_id' });
  const { data: transcript, error: te } = await db.from('call_transcripts').select('text').eq('call_id', call_id).single();
  if (te || !transcript) return res.status(400).json({ success: false, error: 'No transcript found' });
  const { sentiment, score } = analyzeBasicSentiment(transcript.text);
  const topics = extractKeywords(transcript.text);
  const { data: insight, error: ie } = await db.from('call_insights').upsert({ call_id, user_id, org_id, sentiment, sentiment_score: score, topics, ai_model: 'rule-based', generated_at: new Date().toISOString() }).select().single();
  if (ie) return res.status(500).json({ success: false, error: ie.message });
  return res.json({ success: true, call_id, sentiment, sentiment_score: score, topics, insight_id: insight.insight_id });
}

async function handleBatchAnalyze(req: VercelRequest, res: VercelResponse) {
  const db = supabaseAdmin;
  if (!db) return res.status(503).json({ error: 'Supabase admin not configured' });
  const { data: transcripts } = await db.from('call_transcripts').select('call_id, text, org_id').limit(20);
  if (!transcripts || transcripts.length === 0) return res.json({ success: true, processed: 0, message: 'No pending transcripts' });
  let processed = 0;
  for (const t of transcripts) {
    try {
      const { sentiment, score } = analyzeBasicSentiment(t.text);
      const topics = extractKeywords(t.text);
      await db.from('call_insights').upsert({ call_id: t.call_id, org_id: t.org_id, sentiment, sentiment_score: score, topics, ai_model: 'rule-based', generated_at: new Date().toISOString() });
      processed++;
    } catch (_) {}
  }
  return res.json({ success: true, processed, message: `Analyzed ${processed} calls` });
}

async function handleGetMetrics(req: VercelRequest, res: VercelResponse) {
  const db = supabaseAdmin;
  if (!db) return res.status(503).json({ error: 'Supabase admin not configured' });
  const { user_id, org_id } = req.body;
  if (!user_id || !org_id) return res.status(400).json({ success: false, error: 'Missing user_id or org_id' });
  const { data: calls } = await db.from('call_insights').select('sentiment, sentiment_score, topics, created_at').eq('user_id', user_id).eq('org_id', org_id).order('created_at', { ascending: false }).limit(20);
  if (!calls || calls.length === 0) return res.json({ success: true, metrics: null });
  const sentiments = calls.map((c: any) => c.sentiment);
  const pos = sentiments.filter((s: string) => s === 'POSITIVE').length;
  const neg = sentiments.filter((s: string) => s === 'NEGATIVE').length;
  const allTopics: string[] = calls.flatMap((c: any) => c.topics || []);
  const freq: Record<string, number> = {};
  allTopics.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  const topicsRanked = Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, 5).map(([t]) => t);
  return res.json({ success: true, metrics: { total_calls: calls.length, sentiment_distribution: { positive: pos, negative: neg, neutral: calls.length - pos - neg, positive_rate: Math.round((pos / calls.length) * 100) }, top_topics: topicsRanked, areas_of_strength: topicsRanked.filter(t => ['closing_signal', 'call_to_action', 'needs_discovery'].includes(t)), areas_for_improvement: topicsRanked.filter(t => ['objection_handling', 'competitor_mention'].includes(t)) } });
}

// ---------------------------------------------------------------------------
// Automation engine
// ---------------------------------------------------------------------------

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

async function wasRecentlyFired(
  sb: any, ruleId: string, entityType: string, entityId: string, cooldownHours: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 3_600_000).toISOString();
  const { data } = await sb.from('automation_runs')
    .select('id').eq('rule_id', ruleId).eq('entity_type', entityType)
    .eq('entity_id', entityId).gte('created_at', cutoff).limit(1).maybeSingle();
  return !!data;
}

async function fireTask(
  sb: any, ruleId: string, entityType: string, entityId: string,
  title: string, priority: string, contactId: string | null
): Promise<void> {
  const dueDate = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const { data: task } = await sb.from('tasks').insert({
    title, contact_id: contactId, due_date: dueDate, completed: false, priority: priority || 'medium',
  }).select('id').single().catch(() => ({ data: null }));
  await sb.from('automation_runs').insert({
    rule_id: ruleId, entity_type: entityType, entity_id: entityId, task_id: task?.id ?? null, status: 'completed',
  });
}

async function runAutomation(_req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const { data: rules } = await supabase.from('automation_rules').select('*').eq('is_active', true);
    if (!rules?.length) return res.json({ success: true, tasksCreated: 0 });
    let tasksCreated = 0;
    const log: string[] = [];

    for (const rule of rules) {
      try {
        switch (rule.trigger_type) {

          case 'whatsapp_unread': {
            const hours = rule.trigger_config?.hours ?? 2;
            const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
            const { data: inbound } = await supabase.from('interactions')
              .select('contact_id').eq('type', 'WHATSAPP').eq('direction', 'INBOUND').lt('timestamp', cutoff).limit(50);
            if (!inbound?.length) break;
            const cids = [...new Set(inbound.map((r: any) => r.contact_id).filter(Boolean))];
            const { data: replied } = await supabase.from('interactions')
              .select('contact_id').eq('type', 'WHATSAPP').eq('direction', 'OUTBOUND').gte('timestamp', cutoff).in('contact_id', cids);
            const repliedSet = new Set((replied || []).map((r: any) => r.contact_id));
            for (const cid of cids) {
              if (repliedSet.has(cid)) continue;
              if (await wasRecentlyFired(supabase, rule.id, 'contact', cid, rule.cooldown_hours)) continue;
              const { data: c } = await supabase.from('contacts').select('name').eq('id', cid).maybeSingle();
              const title = interpolate(rule.action_config.title ?? 'Reply to {{name}} on WhatsApp', { name: c?.name ?? 'contact' });
              await fireTask(supabase, rule.id, 'contact', cid, title, rule.action_config.priority ?? 'high', cid);
              tasksCreated++; log.push(`whatsapp_unread: ${c?.name ?? cid}`);
            }
            break;
          }

          case 'no_activity': {
            const days = rule.trigger_config?.days ?? 14;
            const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
            const { data: contacts } = await supabase.from('contacts')
              .select('id, name').not('assigned_to', 'is', null).limit(200);
            if (!contacts?.length) break;
            const { data: recent } = await supabase.from('interactions')
              .select('contact_id').in('contact_id', contacts.map((c: any) => c.id)).gte('timestamp', cutoff);
            const activeSet = new Set((recent || []).map((r: any) => r.contact_id));
            for (const contact of contacts) {
              if (activeSet.has(contact.id)) continue;
              if (await wasRecentlyFired(supabase, rule.id, 'contact', contact.id, rule.cooldown_hours)) continue;
              const title = interpolate(rule.action_config.title ?? 'Re-engage {{name}}', { name: contact.name ?? 'contact', days: String(days) });
              await fireTask(supabase, rule.id, 'contact', contact.id, title, rule.action_config.priority ?? 'medium', contact.id);
              tasksCreated++; log.push(`no_activity: ${contact.name}`);
            }
            break;
          }

          case 'lead_no_contact': {
            const hours = rule.trigger_config?.hours ?? 4;
            const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
            const { data: leads } = await supabase.from('leads')
              .select('id, name, contact_id').eq('status', 'new').lt('created_at', cutoff).limit(30);
            if (!leads?.length) break;
            for (const lead of leads) {
              if (!lead.contact_id) continue;
              const { data: ex } = await supabase.from('interactions').select('id').eq('contact_id', lead.contact_id).limit(1).maybeSingle();
              if (ex) continue;
              if (await wasRecentlyFired(supabase, rule.id, 'contact', lead.contact_id, rule.cooldown_hours)) continue;
              const title = interpolate(rule.action_config.title ?? 'First contact: call {{name}}', { name: lead.name ?? 'lead' });
              await fireTask(supabase, rule.id, 'contact', lead.contact_id, title, rule.action_config.priority ?? 'high', lead.contact_id);
              tasksCreated++; log.push(`lead_no_contact: ${lead.name}`);
            }
            break;
          }

          case 'deal_stale': {
            const days = rule.trigger_config?.days ?? 7;
            const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
            const { data: deals } = await supabase.from('deals')
              .select('id, name, updated_at, contact_id').lt('updated_at', cutoff)
              .not('stage', 'in', '("Delivered","Lost")').limit(20);
            if (!deals?.length) break;
            for (const deal of deals) {
              if (await wasRecentlyFired(supabase, rule.id, 'deal', deal.id, rule.cooldown_hours)) continue;
              const staleDays = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86_400_000);
              const title = interpolate(rule.action_config.title ?? 'Push {{name}} deal forward — stalled {{days}}d', { name: deal.name ?? 'deal', days: String(staleDays) });
              await fireTask(supabase, rule.id, 'deal', deal.id, title, rule.action_config.priority ?? 'medium', deal.contact_id ?? null);
              tasksCreated++; log.push(`deal_stale: ${deal.name} (${staleDays}d)`);
            }
            break;
          }

          case 'missing_data': {
            const field = rule.trigger_config?.field ?? 'phone';
            const { data: contacts } = await supabase.from('contacts').select('id, name').is(field, null).limit(50);
            if (!contacts?.length) break;
            for (const contact of contacts) {
              if (await wasRecentlyFired(supabase, rule.id, 'contact', contact.id, rule.cooldown_hours)) continue;
              const title = interpolate(rule.action_config.title ?? 'Add {{field}} for {{name}}', { name: contact.name ?? 'contact', field });
              await fireTask(supabase, rule.id, 'contact', contact.id, title, rule.action_config.priority ?? 'low', contact.id);
              tasksCreated++; log.push(`missing_data(${field}): ${contact.name}`);
            }
            break;
          }
        }
      } catch (ruleErr: any) {
        log.push(`[${rule.trigger_type}] error: ${ruleErr.message}`);
      }
    }
    return res.json({ success: true, tasksCreated, rulesRun: rules.length, log });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function getAutomationStatus(_req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const { data: rules } = await supabase.from('automation_rules').select('*').order('created_at');
  const { data: runs } = await supabase.from('automation_runs')
    .select('rule_id, created_at').order('created_at', { ascending: false }).limit(500);
  const byRule = (runs || []).reduce((acc: Record<string, any[]>, r: any) => {
    (acc[r.rule_id] = acc[r.rule_id] || []).push(r); return acc;
  }, {});
  return res.json({
    rules: (rules || []).map((r: any) => ({
      ...r,
      lastFired: byRule[r.id]?.[0]?.created_at ?? null,
      totalTasksCreated: byRule[r.id]?.length ?? 0,
    })),
  });
}

async function toggleAutomationRule(req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  const { ruleId, isActive } = req.body;
  if (!ruleId) return res.status(400).json({ error: 'ruleId required' });
  await supabase.from('automation_rules').update({ is_active: isActive }).eq('id', ruleId);
  return res.json({ success: true });
}

// ── Team Stats ───────────────────────────────────────────────────────────────

async function getTeamStats(_req: VercelRequest, res: VercelResponse) {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const [{ data: users }, { data: devices }, { data: calls }, { data: deals }] = await Promise.all([
    supabase.from('user_profiles').select('id, name, email, role, companion_installed').eq('is_active', true).order('created_at', { ascending: true }),
    supabase.from('devices').select('phone_number, user_id').not('user_id', 'is', null).eq('is_active', true),
    supabase.from('cellular_calls').select('rep_phone, call_type'),
    supabase.from('deals').select('assigned_to, stage, value'),
  ]);

  // phone → user_id and user_id → phones
  const userPhones: Record<string, string[]> = {};
  for (const d of (devices || [])) {
    if (d.user_id && d.phone_number) {
      userPhones[d.user_id] = userPhones[d.user_id] || [];
      userPhones[d.user_id].push(d.phone_number);
    }
  }

  // call counts by phone
  const callsByPhone: Record<string, { out: number; in: number; missed: number }> = {};
  for (const c of (calls || [])) {
    if (!c.rep_phone) continue;
    callsByPhone[c.rep_phone] = callsByPhone[c.rep_phone] || { out: 0, in: 0, missed: 0 };
    const t = String(c.call_type || '').toUpperCase();
    if (t === 'OUTGOING') callsByPhone[c.rep_phone].out++;
    else if (t === 'INCOMING') callsByPhone[c.rep_phone].in++;
    else if (t === 'MISSED') callsByPhone[c.rep_phone].missed++;
  }

  // deal stats by user_id
  const dealsByUser: Record<string, { count: number; closed: number; revenue: number }> = {};
  let totalActive = 0;
  let totalClosed = 0;
  for (const d of (deals || [])) {
    const uid = d.assigned_to;
    if (uid) {
      dealsByUser[uid] = dealsByUser[uid] || { count: 0, closed: 0, revenue: 0 };
      dealsByUser[uid].count++;
      if (d.stage === 'Delivered') {
        dealsByUser[uid].closed++;
        dealsByUser[uid].revenue += (d.value || 0);
      }
    }
    if (d.stage !== 'Delivered' && d.stage !== 'Lost') totalActive++;
    if (d.stage === 'Delivered') totalClosed++;
  }

  const stats = (users || []).map(user => {
    const phones = userPhones[user.id] || [];
    let out = 0, incoming = 0, missed = 0;
    for (const ph of phones) {
      out += callsByPhone[ph]?.out || 0;
      incoming += callsByPhone[ph]?.in || 0;
      missed += callsByPhone[ph]?.missed || 0;
    }
    const ds = dealsByUser[user.id] || { count: 0, closed: 0, revenue: 0 };
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companion_installed: user.companion_installed,
      has_device: phones.length > 0,
      outgoing: out,
      incoming,
      missed,
      total_calls: out + incoming + missed,
      deal_count: ds.count,
      deals_closed: ds.closed,
      revenue: ds.revenue,
    };
  });

  const totalCalls = stats.reduce((s, r) => s + r.total_calls, 0);

  return res.json({ success: true, stats, totals: { calls: totalCalls, active_deals: totalActive, closed_deals: totalClosed, members: stats.length } });
}
