import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://dhd-crm-saletrail.vercel.app';

// Admin client — service role, never exposed to frontend
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Regular client — for signInWithPassword (uses anon key)
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const generateTempPassword = () =>
  Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!';

const sendInviteEmail = async (to: string, name: string, role: string, tempPassword: string) => {
  if (!RESEND_API_KEY) return { sent: false, reason: 'no_key' };
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'DHD SalesTrail <support@dirtyhanddesigns.com>',
        to: [to],
        subject: "You've been invited to DHD SalesTrail",
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#fff;">
            <div style="background:#f59e0b;width:48px;height:48px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
              <span style="color:#000;font-weight:900;font-size:16px;">DH</span>
            </div>
            <h2 style="color:#111;margin:0 0 8px 0;">You've been invited to DHD SalesTrail</h2>
            <p style="color:#555;margin:0 0 24px 0;">Hi <strong>${name}</strong>, you've been added as a <strong>${role.replace('_', ' ')}</strong>.</p>
            <div style="background:#f9f9f9;border:1px solid #eee;border-radius:12px;padding:20px;margin:0 0 24px 0;">
              <p style="margin:0 0 8px 0;color:#333;font-weight:600;">Your login details:</p>
              <p style="margin:0 0 4px 0;color:#555;">Email: <strong>${to}</strong></p>
              <p style="margin:0 0 16px 0;color:#555;">Temporary password: <strong style="font-family:monospace;background:#eee;padding:2px 6px;border-radius:4px;">${tempPassword}</strong></p>
              <p style="margin:0;color:#888;font-size:13px;">Please change your password after first login.</p>
            </div>
            <a href="${APP_URL}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">Log In Now</a>
            <p style="color:#aaa;font-size:12px;margin:24px 0 0 0;">If you weren't expecting this invite, you can ignore this email.</p>
          </div>
        `
      })
    });
    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.error('[api/users] Resend error:', err);
      return { sent: false, reason: 'api_error', status: emailRes.status };
    }
    return { sent: true };
  } catch (e: any) {
    console.error('[api/users] Resend network error:', e.message);
    return { sent: false, reason: 'network_error' };
  }
};

const sendResetEmail = async (to: string, name: string, tempPassword: string) => {
  if (!RESEND_API_KEY) return { sent: false, reason: 'no_key' };
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'DHD SalesTrail <support@dirtyhanddesigns.com>',
        to: [to],
        subject: 'Your DHD SalesTrail password has been reset',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#fff;">
            <div style="background:#f59e0b;width:48px;height:48px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
              <span style="color:#000;font-weight:900;font-size:16px;">DH</span>
            </div>
            <h2 style="color:#111;margin:0 0 8px 0;">Password Reset</h2>
            <p style="color:#555;margin:0 0 24px 0;">Hi <strong>${name}</strong>, your password has been reset by an administrator.</p>
            <div style="background:#f9f9f9;border:1px solid #eee;border-radius:12px;padding:20px;margin:0 0 24px 0;">
              <p style="margin:0 0 8px 0;color:#333;font-weight:600;">Your new temporary password:</p>
              <p style="margin:0 0 4px 0;color:#555;">Email: <strong>${to}</strong></p>
              <p style="margin:0 0 16px 0;color:#555;">Password: <strong style="font-family:monospace;background:#eee;padding:2px 6px;border-radius:4px;">${tempPassword}</strong></p>
              <p style="margin:0;color:#888;font-size:13px;">Please change your password after logging in.</p>
            </div>
            <a href="${APP_URL}" style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">Log In Now</a>
          </div>
        `
      })
    });
    if (!emailRes.ok) return { sent: false, reason: 'api_error', status: emailRes.status };
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: 'network_error' };
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action as string;

  try {
    switch (action) {

      // POST /api/users?action=login — authenticate with email + password
      case 'login': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'email and password required' });

        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });
        if (authError) return res.json({ success: false, error: 'Invalid email or password' });

        // Fetch profile for name + role
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('id, name, email, role')
          .eq('id', authData.user.id)
          .eq('is_active', true)
          .single();

        if (profileError || !profile) {
          return res.json({ success: false, error: 'Account not found. Contact your administrator.' });
        }

        return res.json({
          success: true,
          user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role },
          expiresAt: authData.session.expires_at
        });
      }

      // GET /api/users?action=list — all active team members
      case 'list': {
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('id, name, email, role, companion_installed, whatsapp_connected, is_active, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true, users: data || [] });
      }

      // POST /api/users?action=invite — invite a new team member (or reactivate a disabled one)
      case 'invite': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { name, email, role } = req.body;
        if (!name || !email || !role) return res.status(400).json({ success: false, error: 'name, email and role are required' });

        const tempPassword = generateTempPassword();

        // Check for an existing profile (active or soft-deleted)
        const { data: existingProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('id, is_active')
          .eq('email', email)
          .maybeSingle();

        let invitedUserId: string;

        if (existingProfile) {
          if (existingProfile.is_active) {
            return res.json({ success: false, error: 'A team member with this email is already active.' });
          }

          // Reactivate: recreate auth account with the same UUID so all historical data links stay intact
          const { error: authError } = await supabaseAdmin.auth.admin.createUser({
            id: existingProfile.id,
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name, role }
          });
          if (authError) return res.json({ success: false, error: authError.message });

          const { error: updateError } = await supabaseAdmin
            .from('user_profiles')
            .update({ name, role, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existingProfile.id);
          if (updateError) return res.json({ success: false, error: updateError.message });

          invitedUserId = existingProfile.id;
        } else {
          // Brand new user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name, role }
          });
          if (authError) return res.json({ success: false, error: authError.message });

          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({ id: authData.user.id, name, email, role, is_active: true });

          if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return res.json({ success: false, error: profileError.message });
          }

          invitedUserId = authData.user.id;
        }

        // Send invite email
        const emailResult = await sendInviteEmail(email, name, role, tempPassword);
        if (!emailResult.sent) {
          const reason = emailResult.reason === 'no_key'
            ? 'No email provider configured'
            : `Email failed (${(emailResult as any).status || emailResult.reason})`;
          return res.json({
            success: true,
            userId: invitedUserId,
            tempPassword,
            warning: `${reason}. Share these credentials manually — Email: ${email} / Password: ${tempPassword}`
          });
        }

        return res.json({ success: true, userId: invitedUserId });
      }

      // PUT /api/users?action=update — update name or role
      case 'update': {
        if (req.method !== 'PUT') return res.status(405).json({ error: 'PUT required' });
        const { id, name, role } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        const updates: any = { updated_at: new Date().toISOString() };
        if (name) updates.name = name;
        if (role) updates.role = role;

        const { error } = await supabaseAdmin.from('user_profiles').update(updates).eq('id', id);
        if (error) return res.json({ success: false, error: error.message });
        return res.json({ success: true });
      }

      // DELETE /api/users?action=remove — soft delete: block login, keep history, clear open assignments
      case 'remove': {
        if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE required' });
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        // 1. Soft-delete profile (keeps historical attribution on calls, deals, messages)
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (profileError) return res.json({ success: false, error: profileError.message });

        // 2. Delete from Supabase Auth so they cannot log in
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) return res.json({ success: false, error: authError.message });

        // 3. Clear open assignments so work moves to unassigned pool
        await supabaseAdmin.from('contacts').update({ assigned_to: null }).eq('assigned_to', id);
        await supabaseAdmin.from('whatsapp_chats').update({ assigned_to_user_id: null }).eq('assigned_to_user_id', id);
        await supabaseAdmin.from('tasks').update({ assigned_to: null }).eq('assigned_to', id);
        await supabaseAdmin.from('leads').update({ assigned_to: null }).eq('assigned_to', id);
        await supabaseAdmin.from('deals').update({ assigned_to: null }).eq('assigned_to', id);

        return res.json({ success: true });
      }

      // POST /api/users?action=resetPassword — admin sets a new temp password for a team member
      case 'resetPassword': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('email, name')
          .eq('id', id)
          .single();

        if (!profile) return res.json({ success: false, error: 'User not found' });

        const tempPassword = generateTempPassword();

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: tempPassword });
        if (updateError) return res.json({ success: false, error: updateError.message });

        const emailResult = await sendResetEmail(profile.email, profile.name, tempPassword);

        if (!emailResult.sent) {
          return res.json({
            success: true,
            tempPassword,
            warning: `Password reset but email failed. Share manually — Email: ${profile.email} / New Password: ${tempPassword}`
          });
        }

        return res.json({ success: true, tempPassword });
      }

      // POST /api/users?action=changePassword — change own password (requires current password)
      case 'changePassword': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { id, email, currentPassword, newPassword } = req.body;
        if (!id || !email || !currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'All fields required' });
        }
        if (newPassword.length < 8) {
          return res.json({ success: false, error: 'New password must be at least 8 characters' });
        }

        // Verify current password is correct before allowing change
        const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({ email, password: currentPassword });
        if (verifyError) return res.json({ success: false, error: 'Current password is incorrect' });

        // Update to new password via admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: newPassword });
        if (updateError) return res.json({ success: false, error: updateError.message });

        return res.json({ success: true });
      }

      // POST /api/users?action=createOwner — one-time setup of owner account
      case 'createOwner': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { email, password, name } = req.body;
        if (!email || !password || !name) return res.status(400).json({ success: false, error: 'email, password and name required' });

        // Check if owner already exists
        const { data: existing } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('role', 'owner')
          .single();

        if (existing) return res.json({ success: false, error: 'Owner account already exists' });

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true
        });

        if (authError) return res.json({ success: false, error: authError.message });

        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .insert({ id: authData.user.id, name, email, role: 'owner', is_active: true });

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
