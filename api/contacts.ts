import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveContact } from './_resolveContact';

export { resolveContact } from './_resolveContact';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action, id } = req.query as Record<string, string>;

  // GET /api/contacts — list all contacts
  if (req.method === 'GET' && !id && !action) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ contacts: data });
  }

  // GET /api/contacts?id=<uuid> — single contact with interactions
  if (req.method === 'GET' && id) {
    const [{ data: contact, error: ce }, { data: interactions }] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase
        .from('interactions')
        .select('*')
        .eq('contact_id', id)
        .order('timestamp', { ascending: false })
        .limit(100),
    ]);

    if (ce) return res.status(404).json({ error: 'Contact not found' });
    return res.status(200).json({ contact, interactions: interactions || [] });
  }

  // POST /api/contacts?action=resolve — identity resolution
  if (req.method === 'POST' && action === 'resolve') {
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      source?: string;
      company?: string;
    };

    if (!body.email && !body.phone) {
      return res.status(400).json({ error: 'email or phone required' });
    }

    const result = await resolveContact({
      name: body.name || 'Unknown',
      email: body.email,
      phone: body.phone,
      source: (body.source as any) || 'MANUAL',
      company: body.company,
    });

    if (!result) return res.status(500).json({ error: 'Resolution failed' });
    return res.status(200).json(result);
  }

  // GET or POST /api/contacts?action=migrate — one-time leads → contacts backfill
  if (action === 'migrate') {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

    const { data: leads, error: le } = await supabase
      .from('leads')
      .select('id, name, email, phone, company, source, notes')
      .is('contact_id', null);

    if (le) return res.status(500).json({ error: le.message });
    if (!leads || leads.length === 0) {
      return res.status(200).json({ migrated: 0, message: 'Nothing to migrate' });
    }

    let migrated = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      const result = await resolveContact({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: 'MANUAL',
        notes: lead.notes,
      });

      if (result) {
        await supabase
          .from('leads')
          .update({ contact_id: result.id })
          .eq('id', lead.id);
        migrated++;
      } else {
        errors.push(lead.id);
      }
    }

    return res.status(200).json({ migrated, errors });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
