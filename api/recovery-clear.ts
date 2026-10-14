import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const { tokenHash, newPassword } = req.body || {};
  if (typeof tokenHash !== 'string' || !tokenHash.trim() || tokenHash.length > 4096 ||
      typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 1024) {
    return res.status(400).json({ success: false, error: 'A recovery token and password of 8–1024 characters are required.' });
  }
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !adminKey) return res.status(503).json({ success: false, error: 'Recovery is temporarily unavailable.' });

  let authClient: ReturnType<typeof createClient> | undefined;
  let recovered = false;
  let passwordUpdated = false;
  try {
    // Recovery mutates auth session state: never share this client between requests.
    const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
    authClient = createClient(url, anonKey, options);
    const admin = createClient(url, adminKey, options);
    const { data, error } = await authClient.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error || !data?.user || !data?.session) return res.status(401).json({ success: false, error: 'Invalid or expired recovery link. Request a new recovery link.' });
    recovered = true;
    const { data: updated, error: updateError } = await authClient.auth.updateUser({ password: newPassword });
    if (updateError || updated?.user?.id !== data.user.id) return res.status(400).json({ success: false, error: 'Password update could not be completed. Request a new recovery link.' });
    passwordUpdated = true;
    const { data: profile, error: cleanupError } = await admin.from('user_profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', data.user.id).eq('is_active', true).select('id').maybeSingle();
    if (cleanupError || !profile) return res.status(500).json({ success: false, passwordUpdated: true, error: 'Password updated, but account cleanup failed. Contact an administrator.' });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ success: false, ...(passwordUpdated ? { passwordUpdated: true } : {}), error: passwordUpdated ? 'Password updated, but account cleanup failed. Contact an administrator.' : 'Recovery could not be completed. Request a new recovery link.' });
  } finally {
    if (recovered && authClient) {
      try { await authClient.auth.signOut({ scope: 'local' }); } catch { /* Discard only this request's recovery session; preserve the result. */ }
    }
  }
}
