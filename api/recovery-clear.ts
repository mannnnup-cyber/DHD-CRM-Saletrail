// Narrowly-scoped server action: receives user's valid access token, resolves identity,
// clears must_change_password for that user ONLY. Receives NO password, NO action_link.
import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token required' });

  // Resolve user from token using user-authenticated Supabase (not service-role for identity)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  // Clear ONLY for this authenticated user — service-role used ONLY for profile update on resolved id,
  // never to receive password or recovery token.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: upErr } = await supabaseAdmin.from('user_profiles')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (upErr) return res.status(500).json({ error: 'Clear failed' });
  return res.json({ success: true });
}
