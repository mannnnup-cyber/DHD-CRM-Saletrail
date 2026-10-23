import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed = ['name', 'email', 'phone', 'company', 'contact_preference', 'timezone', 'linkedin_url'];
export function contactChanges(body: unknown): Record<string, string | null> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new Error('Unsupported contact fields.');
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string' || value.length > (key === 'linkedin_url' ? 500 : 254)) throw new Error('Invalid contact field.');
    result[key] = value.trim() || null;
  }
  if (!Object.keys(result).length || ('name' in result && !result.name)) throw new Error('A contact name is required.');
  if (result.email) {
    result.email = result.email.toLowerCase();
    if (!/^[^\s@,;()]+@[^\s@,;()]+\.[^\s@,;()]+$/.test(result.email)) throw new Error('Enter a valid email address.');
  }
  if ('phone' in result) {
    if (result.phone && !/^\+?[0-9 ()-]{7,30}$/.test(result.phone)) throw new Error('Enter a valid phone number.');
    const digits = (result.phone || '').replace(/\D/g, '');
    if (result.phone && (digits.length < 7 || digits.length > 15)) throw new Error('Enter a valid phone number.');
    result.phone_normalized = digits ? digits.slice(-10) : null;
  }
  if (result.contact_preference && !['call', 'whatsapp', 'email', 'sms'].includes(result.contact_preference)) throw new Error('Invalid contact preference.');
  if (result.linkedin_url) { try { const url = new URL(result.linkedin_url); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw new Error('Enter a valid HTTP or HTTPS URL.'); } }
  return result;
}
export async function editContact(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization) || authorization.length > 8192) return res.status(401).json({ error: 'Authentication required.' });
  if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) return res.status(415).json({ error: 'JSON required.' });
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) return res.status(503).json({ error: 'Contact editing is unavailable.' });
  try {
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const auth = createClient(url, anon, options), admin = createClient(url, secret, options);
    const { data: identity, error: authError } = await auth.auth.getUser(authorization.slice(7));
    if (authError || !identity.user) return res.status(401).json({ error: 'Invalid or expired session.' });
    const { data: profile, error: profileError } = await admin.from('user_profiles').select('id,role,is_active').eq('id', identity.user.id).eq('is_active', true).maybeSingle();
    if (profileError) return res.status(503).json({ error: 'Contact editing is unavailable.' });
    if (!profile || profile.id !== identity.user.id || profile.is_active !== true || !['owner', 'manager'].includes(profile.role)) return res.status(403).json({ error: 'Contact corrections require an active owner or manager.' });
    if (typeof req.query.id !== 'string' || !uuid.test(req.query.id)) return res.status(400).json({ error: 'Invalid contact ID.' });
    let changes: ReturnType<typeof contactChanges>;
    try { changes = contactChanges(req.body); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid contact fields.' }); }
    const { data: current, error: currentError } = await admin.from('contacts').select('id,email,phone_normalized').eq('id', req.query.id).maybeSingle();
    if (currentError) return res.status(503).json({ error: 'Could not verify the current contact.' });
    if (!current) return res.status(404).json({ error: 'Contact not found.' });
    // Reject obvious collisions; this is not a replacement for a database uniqueness constraint.
    for (const field of ['email', 'phone_normalized']) {
      if (!changes[field] || changes[field] === (field === 'email' ? current.email?.trim().toLowerCase() : current.phone_normalized)) continue;
      let query = admin.from('contacts').select('id');
      query = field === 'email' ? query.ilike(field, changes[field]!.replace(/[\\%_]/g, '\\$&')) : query.eq(field, changes[field]);
      const { data, error } = await query.neq('id', req.query.id).limit(1);
      if (error) return res.status(503).json({ error: 'Could not verify contact uniqueness.' });
      if (data?.length) return res.status(409).json({ error: 'Another contact already uses this email or phone. Review duplicates before saving.' });
    }
    const { data, error } = await admin.from('contacts').update(changes).eq('id', req.query.id).select('id,name,email,phone,company,contact_preference,timezone,linkedin_url').maybeSingle();
    if (error) return res.status(503).json({ error: 'Could not save contact corrections.' });
    if (!data) return res.status(404).json({ error: 'Contact not found.' });
    return res.json({ success: true, contact: data });
  } catch { return res.status(503).json({ error: 'Contact editing is unavailable.' }); }
}
