import { contactCaller, contactFailure, type ContactCaller } from './auth-server.js';
import { contactCandidates } from './review-server.js';
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
export async function editContact(req: VercelRequest, res: VercelResponse, verified?: ContactCaller) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
    const caller=verified || await contactCaller(req,res), admin=caller.admin;
    if(!caller.manager)return res.status(403).json({error:'Contact corrections require an active owner or manager.'});
    if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) return res.status(415).json({ error: 'JSON required.' });
    if (typeof req.query.id !== 'string' || !uuid.test(req.query.id)) return res.status(400).json({ error: 'Invalid contact ID.' });
    let changes: ReturnType<typeof contactChanges>;
    try { changes = contactChanges(req.body); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid contact fields.' }); }
    const { data: current, error: currentError } = await admin.from('contacts').select('id,name,email,phone,phone_normalized,company').eq('id', req.query.id).maybeSingle();
    if (currentError) return res.status(503).json({ error: 'Could not verify the current contact.' });
    if (!current) return res.status(404).json({ error: 'Contact not found.' });
    // Reject obvious collisions; this is not a replacement for a database uniqueness constraint.
    for (const field of ['email', 'phone_normalized']) {
      if (!changes[field] || changes[field] === (field === 'email' ? current.email?.trim().toLowerCase() : current.phone_normalized)) continue;
      let query = admin.from('contacts').select('id');
      query = field === 'email' ? query.ilike(field, changes[field]!.replace(/[\\%_]/g, '\\$&')) : query.eq(field, changes[field]);
      const { data, error } = await query.neq('id', req.query.id).limit(1);
      if (error) return res.status(503).json({ error: 'Could not verify contact uniqueness.' });
      if (data?.length) {
        const identity={...current,...changes};
        const result=await contactCandidates(caller,req.query.id,identity,undefined,false);
        return res.status(409).json({code:'CONTACT_IDENTIFIER_CONFLICT',matchScope:'identifiers',error:'Another contact already uses this email or phone. Review permitted matches before saving.',matchedFields:[field==='email'?'email':'phone'],...result,guidance:'Matching identifiers may be shared. Ask a manager to review any unresolved conflict; no automatic merge or overwrite is available.'});
      }
    }
    const { data, error } = await admin.from('contacts').update(changes).eq('id', req.query.id).select('id,name,email,phone,company,contact_preference,timezone,linkedin_url').maybeSingle();
    if (error) return res.status(503).json({ error: 'Could not save contact corrections.' });
    if (!data) return res.status(404).json({ error: 'Contact not found.' });
    return res.json({ success: true, contact: data });
  } catch(error) { return contactFailure(res,error); }
}
