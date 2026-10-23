import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
export interface ContactCaller { id: string; role: string; manager: boolean; admin: any; }
export class ContactError extends Error { constructor(public status: number, message: string) { super(message); } }
export const reject = (status: number, message: string): never => { throw new ContactError(status, message); };
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const limits = new Map<string, { since: number; count: number }>();
export async function contactCaller(req: VercelRequest, res: VercelResponse): Promise<ContactCaller> {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const token = req.headers.authorization;
  if (typeof token !== 'string' || !/^Bearer \S+$/.test(token) || token.length > 8192) reject(401, 'Authentication required.');
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY, secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) reject(503, 'Contact access is temporarily unavailable.');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const auth = createClient(url!, anon!, options), admin = createClient(url!, secret!, options);
  const { data, error } = await auth.auth.getUser(token!.slice(7));
  if (error || !data?.user) reject(401, 'Invalid or expired session.');
  const { data: profile, error: failure } = await admin.from('user_profiles').select('id,email,role,is_active').eq('id', data.user!.id).eq('is_active', true).maybeSingle();
  if (failure) reject(503, 'Contact access is temporarily unavailable.');
  if (!profile || profile.id !== data.user!.id || profile.is_active !== true || !['owner','manager','sales_rep','rep'].includes(profile.role)) reject(403, 'Contact access denied.');
  const manager = ['owner','manager'].includes(profile!.role);
  if (!manager) {
    const { data: legacy, error: legacyError } = await admin.from('users').select('id,email,is_active').eq('id', profile!.id).eq('is_active', true).maybeSingle();
    const email = data.user!.email?.trim().toLowerCase();
    if (legacyError || !email || legacy?.id !== profile!.id || legacy?.is_active !== true || legacy.email?.trim().toLowerCase() !== email || profile!.email?.trim().toLowerCase() !== email) reject(403, 'Assigned contact access is unavailable for this identity.');
  }
  const now = Date.now();
  for (const [key, bucket] of limits) if (now - bucket.since > 60000) limits.delete(key);
  if (limits.size >= 1000 && !limits.has(profile!.id)) reject(429, 'Contact request limit reached.');
  const bucket = limits.get(profile!.id) || { since: now, count: 0 }; bucket.count++; limits.set(profile!.id, bucket);
  if (bucket.count > 120) reject(429, 'Contact request limit reached. Try again later.');
  return { id: profile!.id, role: profile!.role, manager, admin };
}
export const scopeContacts = (query: any, caller: ContactCaller, field = 'assigned_to') => caller.manager ? query : query.eq(field, caller.id);
export async function permittedContact(caller: ContactCaller, id: unknown, projection = 'id,name,email,phone,phone_normalized,company,assigned_to,source,sources,created_at,contact_type') {
  if (!uuid(id)) reject(400, 'Invalid contact ID.');
  const { data, error } = await scopeContacts(caller.admin.from('contacts').select(projection).eq('id', id), caller).maybeSingle();
  if (error) reject(503, 'Contact access is temporarily unavailable.');
  if (!data) reject(404, 'Contact is unavailable.');
  return data;
}
export function jsonRequest(req: VercelRequest) {
  if (!/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) reject(415, 'JSON required.');
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 16384) reject(400, 'Invalid contact request.');
}
export function contactFailure(res: VercelResponse, error: unknown) { return res.status(error instanceof ContactError ? error.status : 503).json({ success: false, error: error instanceof ContactError ? error.message : 'Contact access is temporarily unavailable.' }); }
