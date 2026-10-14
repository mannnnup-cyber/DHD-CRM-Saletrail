import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Authentication / authorization ──────────────────────────────────────────
// Verifies the caller's Supabase access token server-side and loads their role
// from user_profiles. Frontend role claims are never trusted. Returns null
// after writing the 401/403 response when the caller is not permitted.

interface Caller { userId: string; email: string; role: string }

async function authenticate(
  req: VercelRequest,
  res: VercelResponse,
  allowedRoles?: string[]
): Promise<Caller | null> {
  const header = (req.headers['authorization'] as string) || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }
  const { data: userData, error: jwtError } = await supabaseAuth.auth.getUser(token);
  if (jwtError || !userData?.user) {
    res.status(401).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
    return null;
  }
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, role, is_active')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!profile) {
    res.status(403).json({ success: false, error: 'Account not found or inactive' });
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    res.status(403).json({ success: false, error: 'Insufficient permissions' });
    return null;
  }
  return { userId: profile.id, email: profile.email, role: profile.role };
}

// ─── Email helpers ────────────────────────────────────────────────────────────

const logoHeader = () => `
  <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#fff;">
    <div style="background:#f59e0b;width:48px;height:48px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
      <span style="color:#000;font-weight:900;font-size:16px;">DH</span>
    </div>`;

const sendResetLinkEmail = async (to: string, name: string, actionLink: string, mode: 'recovery' | 'setup' = 'recovery', settingsClient = supabaseAdmin) => {
  let key = (process.env.RESEND_API_KEY || '').trim();
  let sender = process.env.RECOVERY_FROM_EMAIL || '';
  if (!sender.trim()) sender = '';
  if (!key || !sender) {
    try {
      const { data, error } = await settingsClient.from('app_settings')
        .select('setting_key, setting_value').in('setting_key', ['RESEND_API_KEY', 'RECOVERY_FROM_EMAIL'])
        .order('updated_at', { ascending: false });
      if (error) return { sent: false, reason: 'configuration_unavailable' };
      const settings: Record<string, string> = {};
      for (const row of data || []) {
        if (['RESEND_API_KEY', 'RECOVERY_FROM_EMAIL'].includes(row.setting_key) && !settings[row.setting_key] &&
            typeof row.setting_value === 'string' && row.setting_value.trim()) settings[row.setting_key] = row.setting_value;
      }
      key ||= (settings.RESEND_API_KEY || '').trim();
      sender ||= settings.RECOVERY_FROM_EMAIL || '';
    } catch { return { sent: false, reason: 'configuration_unavailable' }; }
  }
  if (!key) return { sent: false, reason: 'missing_key' };
  sender ||= 'DHD SalesTrail <support@dirtyhanddesigns.com>';
  // Only a single mailbox, optionally with a simple display name, is accepted.
  const mailbox = sender.match(/^(?:([^<>"\r\n]{1,80}) <)?([^\s<>@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63})(>)?$/);
  const validAddress = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
  if (sender.length > 320 || /[\x00-\x1f\x7f]/.test(sender) || !mailbox ||
      Boolean(mailbox[1]) !== Boolean(mailbox[3]) || mailbox[2].length > 254 ||
      !validAddress.test(mailbox[2]) || /(^\.|\.\.|\.@)/.test(mailbox[2])) return { sent: false, reason: 'invalid_sender' };
  const title = mode === 'setup' ? 'Set up your FollOps account' : 'Reset your FollOps password';
  const introduction = mode === 'setup' ? 'your team account is ready. Choose your own password using the secure link below.' : 'a password reset was requested for your account.';
  const escapedName = name.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  try {
    // Recovery delivery must never log provider responses containing the link.
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: sender, to: [to], subject: title, html: `
        ${logoHeader()}
        <h2 style="color:#111;margin:0 0 8px 0;">${title}</h2>
        <p style="color:#555;margin:0 0 24px 0;">Hi <strong>${escapedName}</strong>, ${introduction}</p>
        <p style="color:#555;margin:0 0 16px 0;"><a href="${actionLink.replace(/&/g, '&amp;')}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">${mode === 'setup' ? 'Set Up Account' : 'Reset Password'}</a></p>
        <p style="color:#888;font-size:13px;margin:0;">If you didn't request this, ignore this email. ${mode === 'setup' ? 'No password is included in this email.' : 'Your current password has not changed.'}</p>
      </div>` })
    });
    if (result.ok) return { sent: true };
    if (result.status === 401) return { sent: false, reason: 'invalid_credentials' };
    if (result.status === 429) return { sent: false, reason: 'rate_limited' };
    if (result.status >= 500) return { sent: false, reason: 'provider_unavailable' };
    const failure = await result.json().catch(() => ({}));
    const code = typeof failure?.name === 'string' ? failure.name : failure?.code;
    const message = typeof failure?.message === 'string' ? failure.message.toLowerCase() : '';
    if (code === 'invalid_api_key' || code === 'invalid_access' || message.includes('api key is invalid')) return { sent: false, reason: 'invalid_credentials' };
    if (code === 'domain_not_verified' || (message.includes('domain') && message.includes('not verified'))) return { sent: false, reason: 'sender_unverified' };
    return { sent: false, reason: 'provider_rejected' };
  } catch { return { sent: false, reason: 'provider_unavailable' }; }
};

// ─── Warning helper ──────────────────────────────────────────────────────────
// (Removed emailFailedWarning — it embedded plaintext passwords in API text.)

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action as string;

  try {
    switch (action) {

      // ── Auth ────────────────────────────────────────────────────────────────

      case 'login': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'email and password required' });

        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });
        if (authError) return res.json({ success: false, error: 'Invalid email or password' });

        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('id, name, email, role, must_change_password')
          .eq('id', authData.user.id)
          .eq('is_active', true)
          .single();

        if (!profile) return res.json({ success: false, error: 'Account not found. Contact your administrator.' });

        return res.json({
          success: true,
          user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role },
          accessToken: authData.session.access_token,
          expiresAt: authData.session.expires_at,
          refreshToken: authData.session.refresh_token,
          mustChangePassword: profile.must_change_password || false
        });
      }

      case 'refresh': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ success: false, error: 'refreshToken required' });

        const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session) return res.json({ success: false, error: 'Session expired' });

        return res.json({
          success: true,
          accessToken: data.session.access_token,
          expiresAt: data.session.expires_at,
          refreshToken: data.session.refresh_token
        });
      }

      // ── Public bootstrap probe (no user data exposed) ─────────────────────
      case 'setupStatus': {
        const { count } = await supabaseAdmin
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);
        return res.json({ success: true, needsSetup: (count || 0) === 0 });
      }

      // ── Minimal directory for authenticated pages (id + name only) ───────
      case 'teamDirectory': {
        const caller = await authenticate(req, res);
        if (!caller) return;
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('id, name')
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true, users: data || [] });
      }

      // ── Team management ─────────────────────────────────────────────────────

      case 'list': {
        const caller = await authenticate(req, res, ['owner', 'manager']);
        if (!caller) return;
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('id, name, email, role, companion_installed, whatsapp_connected, is_active, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true, users: data || [] });
      }

      case 'invite': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        let accountCreated = false;
        let invitedUserId: string | undefined;
        let wasReactivated = false;
        try {
          const caller = await authenticate(req, res, ['owner', 'manager']);
          if (!caller) return;
          const { name, email: suppliedEmail, role } = req.body || {};
          const validEmail = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
          if (typeof name !== 'string' || !name.trim() || name.length > 120 || /[\x00-\x1f\x7f]/.test(name) ||
              typeof suppliedEmail !== 'string' || suppliedEmail.length > 254 || !validEmail.test(suppliedEmail) || /(^\.|\.\.|\.@)/.test(suppliedEmail) ||
              !['owner', 'manager', 'sales_rep', 'rep'].includes(role)) return res.status(400).json({ success: false, error: 'A valid name, email and supported role are required.' });
          if (caller.role === 'manager' && !['sales_rep', 'rep'].includes(role)) return res.status(403).json({ success: false, error: 'Managers may invite sales reps only.' });
          const modernKey = process.env.SUPABASE_SECRET_KEY;
          if (!modernKey || !SUPABASE_URL) return res.status(503).json({ success: false, error: 'Account setup is temporarily unavailable.' });
          const admin = createClient(SUPABASE_URL, modernKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
          const email = suppliedEmail.toLowerCase();
          const emailPattern = email.replace(/[\\%_]/g, '\\$&');
          const appOrigin = new URL(process.env.RECOVERY_APP_URL || 'https://dhd-crm-saletrail.vercel.app');
          if (appOrigin.protocol !== 'https:' || appOrigin.username || appOrigin.password) return res.status(503).json({ success: false, error: 'Account setup is temporarily unavailable.' });
          const { data: existing, error: lookupError } = await admin.from('user_profiles')
            .select('id, email, name, role, is_active, must_change_password').ilike('email', emailPattern).maybeSingle();
          if (lookupError) return res.status(500).json({ success: false, error: 'Unable to look up account. Try again later.' });
          if (existing && existing.email?.toLowerCase() !== email) return res.status(500).json({ success: false, error: 'Account identity could not be verified.' });
          if (existing && caller.role === 'manager' && !['sales_rep', 'rep'].includes(existing.role)) return res.status(403).json({ success: false, error: 'Only an owner may manage this account.' });
          if (existing?.is_active) {
            if (!existing.must_change_password) return res.json({ success: false, error: 'A team member with this email is already active.' });
            // Resending a pending setup link must not change an existing role or name.
            invitedUserId = existing.id;
          } else {
            const { data: created, error: createError } = await admin.auth.admin.createUser({
              ...(existing ? { id: existing.id } : {}), email, email_confirm: true, user_metadata: { name: name.trim() }
            });
            if (createError || !created?.user || (existing && created.user.id !== existing.id) || created.user.email?.toLowerCase() !== email) {
              return res.json({ success: false, error: 'Account setup could not be provisioned. Contact an administrator if the account already exists.' });
            }
            invitedUserId = created.user.id;
            wasReactivated = Boolean(existing);
            const values = { name: name.trim(), role, is_active: true, must_change_password: true, updated_at: new Date().toISOString() };
            const persisted = existing
              ? await admin.from('user_profiles').update(values).eq('id', existing.id).eq('is_active', false).select('id').single()
              : await admin.from('user_profiles').insert({ id: invitedUserId, email, ...values }).select('id').single();
            if (persisted.error || persisted.data?.id !== invitedUserId) {
              try { await admin.auth.admin.deleteUser(invitedUserId); } catch { /* No account access was granted; preserve sanitized failure. */ }
              return res.status(500).json({ success: false, error: 'Account profile could not be provisioned. Contact an administrator before retrying.' });
            }
          }
          accountCreated = true;
          const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email });
          const hash = linkData?.properties?.hashed_token;
          if (linkError || linkData?.user?.id !== invitedUserId || typeof hash !== 'string' || !hash || hash.length > 4096) {
            return res.json({ success: false, accountCreated: true, pendingDelivery: true, userId: invitedUserId, wasReactivated, error: 'Account is pending setup, but the setup link could not be generated. Retry the invitation.' });
          }
          const actionLink = `${appOrigin.origin}/#/recovery?token_hash=${encodeURIComponent(hash)}&type=recovery&mode=setup`;
          const sent = await sendResetLinkEmail(email, existing?.is_active ? existing.name || '' : name.trim(), actionLink, 'setup', admin);
          if (!sent.sent) return res.json({ success: false, accountCreated: true, pendingDelivery: true, userId: invitedUserId, wasReactivated, deliveryError: sent.reason, error: 'Account is pending setup, but the setup email could not be delivered. Retry the invitation or use Reset Password after email delivery is available.' });
          return res.json({ success: true, emailSent: true, userId: invitedUserId, wasReactivated, message: 'Account setup link sent.' });
        } catch {
          return res.status(500).json({ success: false, ...(accountCreated ? { accountCreated: true, pendingDelivery: true, userId: invitedUserId, wasReactivated } : {}), error: accountCreated ? 'Account is pending setup. Retry the invitation to send a new setup link.' : 'Account setup could not be completed. Contact an administrator before retrying.' });
        }
      }

      case 'update': {
        if (req.method !== 'PUT') return res.status(405).json({ error: 'PUT required' });
        const caller = await authenticate(req, res, ['owner', 'manager']);
        if (!caller) return;
        const { id, name, role } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        const updates: any = { updated_at: new Date().toISOString() };
        if (name) updates.name = name;
        if (role) updates.role = role;

        const { error } = await supabaseAdmin.from('user_profiles').update(updates).eq('id', id);
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true });
      }

      case 'remove': {
        if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE required' });
        const caller = await authenticate(req, res, ['owner', 'manager']);
        if (!caller) return;
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        const { error: profileError } = await supabaseAdmin.from('user_profiles')
          .update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
        if (profileError) return res.json({ success: false, error: profileError.message });

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) return res.json({ success: false, error: authError.message });

        await supabaseAdmin.from('contacts').update({ assigned_to: null }).eq('assigned_to', id);
        await supabaseAdmin.from('whatsapp_chats').update({ assigned_to_user_id: null }).eq('assigned_to_user_id', id);
        await supabaseAdmin.from('tasks').update({ assigned_to: null }).eq('assigned_to', id);
        await supabaseAdmin.from('leads').update({ assigned_to: null }).eq('assigned_to', id);
        await supabaseAdmin.from('deals').update({ assigned_to: null }).eq('assigned_to', id);

        return res.json({ success: true });
      }

      case 'resetPassword': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        try {
          const caller = await authenticate(req, res, ['owner', 'manager']);
          if (!caller) return;
          const { id } = req.body || {};
          if (typeof id !== 'string' || !id || id.length > 128) return res.status(400).json({ success: false, error: 'id is required' });
          const { data: profile } = await supabaseAdmin.from('user_profiles')
            .select('email, name').eq('id', id).eq('is_active', true).single();
          if (!profile) return res.json({ success: false, error: 'Active user not found' });
          // Generated deployment hosts can require SSO; recovery needs a stable public origin.
          const appOrigin = new URL(process.env.RECOVERY_APP_URL || 'https://dhd-crm-saletrail.vercel.app');
          if (appOrigin.protocol !== 'https:' || appOrigin.username || appOrigin.password) {
            return res.status(503).json({ success: false, error: 'Recovery is temporarily unavailable' });
          }
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery', email: profile.email
          });
          const hash = linkData?.properties?.hashed_token;
          if (linkError || typeof hash !== 'string' || !hash || hash.length > 4096) {
            return res.json({ success: false, error: 'Failed to generate recovery link' });
          }
          // The fragment stays out of HTTP requests and avoids SDK hash collisions.
          const actionLink = `${appOrigin.origin}/#/recovery?token_hash=${encodeURIComponent(hash)}&type=recovery`;
          const emailResult = await sendResetLinkEmail(profile.email, profile.name || '', actionLink);
          if (!emailResult.sent) {
            const messages: Record<string, string> = {
              missing_key: 'Recovery email is not configured.',
              configuration_unavailable: 'Recovery email configuration is temporarily unavailable.',
              invalid_sender: 'Recovery email sender configuration is invalid.',
              invalid_credentials: 'Recovery email credentials were rejected by the provider.',
              sender_unverified: 'Recovery email sender domain is not verified.',
              rate_limited: 'Recovery email provider rate limit reached. Try again later.',
              provider_unavailable: 'Recovery email provider is temporarily unavailable. Try again later.',
              provider_rejected: 'Recovery email was rejected by the provider.'
            };
            return res.json({ success: false, deliveryError: emailResult.reason, error: `${messages[emailResult.reason] || 'Recovery link could not be delivered.'} The user's existing password has not been changed.` });
          }
          return res.json({ success: true, message: 'Recovery link sent to user.' });
        } catch {
          return res.status(500).json({ success: false, error: 'Recovery request failed. The existing password has not been changed.' });
        }
      }

      case 'changePassword': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        // Self-service only: identity comes from the verified token, never the
        // body, so a caller can only change their own password.
        const caller = await authenticate(req, res);
        if (!caller) return;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
        }
        if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });

        const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({ email: caller.email, password: currentPassword });
        if (verifyError) return res.json({ success: false, error: 'Current password is incorrect' });

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(caller.userId, { password: newPassword });
        if (updateError) return res.json({ success: false, error: updateError.message });

        // Clear the must-change flag after successful change
        await supabaseAdmin.from('user_profiles')
          .update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', caller.userId);

        return res.json({ success: true });
      }

      // ── Devices ─────────────────────────────────────────────────────────────

      case 'listDevices': {
        const caller = await authenticate(req, res, ['owner', 'manager']);
        if (!caller) return;
        const { data, error } = await supabaseAdmin
          .from('devices')
          .select('device_id, phone_number, device_name, device_model, app_version, user_id, is_active, last_heartbeat, sim_count')
          .order('created_at', { ascending: true });
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true, devices: data || [] });
      }

      case 'linkDevice': {
        if (req.method !== 'PUT') return res.status(405).json({ error: 'PUT required' });
        const caller = await authenticate(req, res, ['owner', 'manager']);
        if (!caller) return;
        const { deviceId, userId, deviceName } = req.body;
        if (!deviceId) return res.status(400).json({ success: false, error: 'deviceId required' });

        const { error } = await supabaseAdmin.from('devices')
          .update({ user_id: userId || null, device_name: deviceName || null, updated_at: new Date().toISOString() })
          .eq('device_id', deviceId);
        if (error) return res.json({ success: false, error: error.message });

        // Backfill rep_name on existing cellular_calls for this device
        if (deviceName !== undefined) {
          const { data: dev } = await supabaseAdmin.from('devices').select('phone_number').eq('device_id', deviceId).maybeSingle();
          if (dev?.phone_number) {
            await supabaseAdmin.from('cellular_calls')
              .update({ rep_name: deviceName || null })
              .eq('rep_phone', dev.phone_number);
          }
        }

        // Mark linked rep as companion_installed
        if (userId) {
          await supabaseAdmin.from('user_profiles').update({ companion_installed: true }).eq('id', userId);
        }

        return res.json({ success: true });
      }

      // ── Owner setup ─────────────────────────────────────────────────────────

      case 'createOwner': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        // Bootstrap-only: when an owner already exists this endpoint requires an
        // owner/manager token (and still refuses). Public access is only
        // permitted on a fresh install with zero owners, for first-run setup.
        const { data: existing } = await supabaseAdmin.from('user_profiles').select('id').eq('role', 'owner').single();
        if (existing) {
          const caller = await authenticate(req, res, ['owner', 'manager']);
          if (!caller) return;
          return res.json({ success: false, error: 'Owner account already exists' });
        }
        const { email, password, name } = req.body;
        if (!email || !password || !name) return res.status(400).json({ success: false, error: 'email, password and name required' });

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true
        });
        if (authError) return res.json({ success: false, error: authError.message });

        const { error: profileError } = await supabaseAdmin.from('user_profiles')
          .insert({ id: authData.user.id, name, email, role: 'owner', is_active: true, must_change_password: false });
        if (profileError) return res.json({ success: false, error: profileError.message });

        return res.json({ success: true, userId: authData.user.id });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error('[api/users]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
