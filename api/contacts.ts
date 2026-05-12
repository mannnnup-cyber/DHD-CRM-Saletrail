import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '');
}

async function resolveContact(opts: {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  company?: string;
  notes?: string;
}): Promise<{ id: string; created: boolean } | null> {
  if (!supabase) return null;
  const emailLower = (opts.email || '').toLowerCase().trim();
  const phoneNorm = normalizePhone(opts.phone || '');

  if (emailLower) {
    const { data } = await supabase.from('contacts').select('id').ilike('email', emailLower).limit(1).single();
    if (data) return { id: data.id, created: false };
  }
  if (phoneNorm) {
    const { data } = await supabase.from('contacts').select('id').eq('phone_normalized', phoneNorm).limit(1).single();
    if (data) return { id: data.id, created: false };
  }

  const { data, error } = await supabase.from('contacts').insert({
    name: opts.name || 'Unknown',
    email: emailLower || null,
    phone: opts.phone || null,
    phone_normalized: phoneNorm || null,
    company: opts.company || null,
    source: opts.source,
    notes: opts.notes || null,
    status: 'NEW',
  }).select('id').single();

  if (error) { console.error('[contacts] insert error:', error.message); return null; }
  return { id: data.id, created: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action, id } = req.query as Record<string, string>;

  if (!action && !id) {
    const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ contacts: data });
  }

  if (!action && id) {
    const [{ data: contact, error: ce }, { data: interactions }] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('interactions').select('*').eq('contact_id', id).order('timestamp', { ascending: false }).limit(100),
    ]);
    if (ce) return res.status(404).json({ error: 'Contact not found' });
    return res.status(200).json({ contact, interactions: interactions || [] });
  }

  if (action === 'resolve' && req.method === 'POST') {
    const body = req.body || {};
    if (!body.email && !body.phone) return res.status(400).json({ error: 'email or phone required' });
    const result = await resolveContact({ name: body.name || 'Unknown', email: body.email, phone: body.phone, source: body.source || 'MANUAL', company: body.company });
    if (!result) return res.status(500).json({ error: 'Resolution failed' });
    return res.status(200).json(result);
  }

  if (action === 'migrate') {
    const { data: leads, error: le } = await supabase.from('leads').select('id, name, email, phone, company, notes').is('contact_id', null);
    if (le) return res.status(500).json({ error: le.message });
    if (!leads || leads.length === 0) return res.status(200).json({ migrated: 0, message: 'Nothing to migrate' });

    let migrated = 0;
    const errors: string[] = [];
    for (const lead of leads) {
      const result = await resolveContact({ name: lead.name, email: lead.email, phone: lead.phone, company: lead.company, source: 'MANUAL', notes: lead.notes });
      if (result) {
        await supabase.from('leads').update({ contact_id: result.id }).eq('id', lead.id);
        migrated++;
      } else {
        errors.push(lead.id);
      }
    }
    return res.status(200).json({ migrated, errors });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
