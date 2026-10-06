import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const _adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseUserAuth = (_url && _anonKey) ? createClient(_url, _anonKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const supabaseAdmin = (_url && _adminKey) ? createClient(_url, _adminKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token required' });

  if (!supabaseUserAuth) return res.status(500).json({ error: 'Auth client unavailable' });
  const { data: { user }, error: authErr } = await supabaseUserAuth.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client unavailable' });
  const { error: upErr } = await supabaseAdmin.from('user_profiles')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (upErr) return res.status(500).json({ error: 'Clear failed', detail: upErr.message });
  return res.status(200).json({ success: true });
}
