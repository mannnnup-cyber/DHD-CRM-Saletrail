import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { projectStoredEmail, deduplicateEmails } from './email.js';

const allowedRoles = ['owner', 'manager', 'sales_rep', 'rep'];
const requestCounts = new Map<string, { since: number; count: number }>();
export interface EmailCaller { id: string; role: string; admin: SupabaseClient<any>; }
export async function authenticateEmail(req: VercelRequest, res: VercelResponse): Promise<EmailCaller | null> {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ') || header.length > 8192 || !header.slice(7).trim()) { res.status(401).json({ success: false, error: 'Authentication required.' }); return null; }
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) { res.status(503).json({ success: false, error: 'Email access is temporarily unavailable.' }); return null; }
  try {
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const auth = createClient(url, anon, options); const admin = createClient(url, secret, options);
    const { data, error } = await auth.auth.getUser(header.slice(7).trim());
    if (error || !data?.user) { res.status(401).json({ success: false, error: 'Invalid or expired session.' }); return null; }
    const { data: profile, error: profileError } = await admin.from('user_profiles').select('id,email,role,is_active').eq('id', data.user.id).eq('is_active', true).maybeSingle();
    if (profileError) { res.status(503).json({ success: false, error: 'Email access is temporarily unavailable.' }); return null; }
    if (!profile || profile.id !== data.user.id || profile.is_active !== true || !allowedRoles.includes(profile.role)) { res.status(403).json({ success: false, error: 'Email access denied.' }); return null; }
    if (!['owner', 'manager'].includes(profile.role)) {
      const { data: legacy, error: legacyError } = await admin.from('users').select('id,email,is_active').eq('id', data.user.id).eq('is_active', true).maybeSingle();
      const email = typeof data.user.email === 'string' ? data.user.email.trim().toLowerCase() : '';
      if (legacyError || !email || legacy?.id !== data.user.id || legacy?.is_active !== true || legacy.email?.trim().toLowerCase() !== email || profile.email?.trim().toLowerCase() !== email) { res.status(403).json({ success: false, error: 'Assigned email access is unavailable for this identity. Contact an administrator.' }); return null; }
    }
    // Best effort per warm process; distributed enforcement belongs to deployment controls.
    const now = Date.now();
    for (const [id, bucket] of requestCounts) if (now - bucket.since > 60000) requestCounts.delete(id);
    if (requestCounts.size >= 1000 && !requestCounts.has(profile.id)) { res.status(429).json({ success: false, error: 'Email request limit reached. Try again later.' }); return null; }
    const bucket = requestCounts.get(profile.id) || { since: now, count: 0 }; bucket.count++; requestCounts.set(profile.id, bucket);
    if (bucket.count > 120) { res.setHeader('Retry-After', '60'); res.status(429).json({ success: false, error: 'Email request limit reached. Try again later.' }); return null; }
    return { id: profile.id, role: profile.role, admin };
  } catch { res.status(503).json({ success: false, error: 'Email access is temporarily unavailable.' }); return null; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export async function listInbox(req: VercelRequest, res: VercelResponse, caller: EmailCaller) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'GET required.' });
  const sizeRaw = req.query.limit;
  const size = sizeRaw === undefined ? 25 : typeof sizeRaw === 'string' && /^\d{1,2}$/.test(sizeRaw) ? Number(sizeRaw) : NaN;
  if (!Number.isInteger(size) || size < 1 || size > 50) return res.status(400).json({ success: false, error: 'Page size must be 1–50.' });
  let cursor: { id: string; date: string | null } | null = null;
  if (req.query.cursor !== undefined) {
    try {
      if (typeof req.query.cursor !== 'string' || req.query.cursor.length > 250) throw new Error();
      cursor = JSON.parse(req.query.cursor);
      if (!cursor || !uuid.test(cursor.id) || !(cursor.date === null || (typeof cursor.date === 'string' && cursor.date.length <= 40 && timestamp.test(cursor.date) && Number.isFinite(Date.parse(cursor.date))))) throw new Error();
    } catch { return res.status(400).json({ success: false, error: 'Invalid page cursor.' }); }
  }
  try {
    const rep = !['owner', 'manager'].includes(caller.role);
    const relation = rep ? 'contact:contacts!inner(id,name,assigned_to)' : 'contact:contacts(id,name,assigned_to)';
    let query = caller.admin.from('emails').select(`id,contact_id,from_email,to_email,subject,body,date,read,${relation}`);
    if (rep) query = query.eq('contact.assigned_to', caller.id);
    if (cursor) query = cursor.date === null ? query.is('date', null).lt('id', cursor.id)
      : query.or(`date.lt.${cursor.date},and(date.eq.${cursor.date},id.lt.${cursor.id}),date.is.null`);
    const { data, error } = await query.order('date', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(size + 1);
    if (error) return res.status(503).json({ success: false, error: 'Stored email access is temporarily unavailable.' });
    const page = (data || []).slice(0, size);
    const items = deduplicateEmails(page.filter((row: any) => !rep || (row && !Array.isArray(row.contact) && row.contact?.id === row.contact_id && row.contact?.assigned_to === caller.id)).map(projectStoredEmail).filter(Boolean));
    const last = page[page.length - 1];
    const nextCursor = (data || []).length > size && last ? JSON.stringify({ id: last.id, date: last.date || null }) : null;
    return res.json({ success: true, items, nextCursor, channels: ['email'], readOnly: true });
  } catch { return res.status(503).json({ success: false, error: 'Stored email access is temporarily unavailable.' }); }
}
