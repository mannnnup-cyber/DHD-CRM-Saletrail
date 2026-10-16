import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { projectMessage, projectReply, socialText, socialUuid } from './social.js';

class SocialError extends Error { constructor(public status: number, message: string, public uncertain = false, public retryAfter = '60') { super(message); } }
const buckets = new Map<string, { since: number; count: number }>();
const fail = (status: number, message: string): never => { throw new SocialError(status, message); };
const scalar = (value: unknown) => typeof value === 'string' ? value : '';
const validId = (value: unknown) => { const id = scalar(value); if (!socialUuid.test(id)) fail(400, 'A valid message or account ID is required.'); return id; };

async function authorize(req: VercelRequest) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ') || header.length > 8192 || !header.slice(7).trim()) fail(401, 'Authentication required.');
  const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) fail(503, 'Social access is temporarily unavailable.');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const auth = createClient(url, anon, options); const admin = createClient(url, secret, options);
  const { data, error } = await auth.auth.getUser(header.slice(7).trim());
  if (error || !data?.user) fail(401, 'Invalid or expired session.');
  const { data: profile, error: profileError } = await admin.from('user_profiles').select('id,role,is_active').eq('id', data.user.id).eq('is_active', true).maybeSingle();
  if (profileError) fail(503, 'Social access is temporarily unavailable.');
  if (!profile || profile.id !== data.user.id || profile.is_active !== true || !['owner', 'manager'].includes(profile.role)) fail(403, 'Social access requires an active owner or manager.');
  const now = Date.now();
  for (const [key, value] of buckets) if (now - value.since >= 60000) buckets.delete(key);
  if (buckets.size >= 1000 && !buckets.has(profile.id)) fail(429, 'Social request limit reached. Try again later.');
  const bucket = buckets.get(profile.id) || { since: now, count: 0 }; bucket.count++; buckets.set(profile.id, bucket);
  if (bucket.count > 100) fail(429, 'Social request limit reached. Try again later.');
  return { admin, id: profile.id };
}

function providerOrigin() {
  try {
    const url = new URL(process.env.BRIGHTBEAN_API_URL || 'https://studio.brightbean.xyz/api/v1');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^\/api\/v1\/?$/.test(url.pathname)) throw new Error();
    return `${url.origin}/api/v1`;
  } catch { return fail(503, 'Social provider configuration is unavailable.'); }
}

function providerClient(origin: string, key: string, res: VercelResponse) {
  return async (path: string, method = 'GET', body?: object) => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${origin}${path}`, { method, headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'FollOps-social/1.0' }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, redirect: 'error', cache: 'no-store' });
      if (response.status === 429) { const retry = response.headers.get('Retry-After'); throw new SocialError(429, 'Social provider rate limit reached. Try again later.', false, retry && /^\d{1,6}$/.test(retry) ? retry : '60'); }
      if (!response.ok) {
        if (response.status === 401) fail(502, 'Social provider rejected its configured key. Contact an administrator.');
        if (response.status === 403) fail(403, 'Social provider permission denied.');
        if (response.status === 404) fail(404, 'Social message or reply is unavailable.');
        if (response.status === 409) fail(409, 'Reply state changed or request is still processing. Refresh the thread before continuing.');
        if (response.status === 422) fail(422, 'Social provider rejected this request. Check the reply and refresh the thread.');
        throw new SocialError(502, method === 'GET' ? 'Social provider is temporarily unavailable.' : 'Reply outcome is uncertain. Refresh the thread and check the platform before retrying.', method !== 'GET');
      }
      if (response.status === 204) return null;
      // Bound the response while streaming; never retain raw provider error bodies.
      const reader = response.body?.getReader(); let raw = ''; let bytes = 0;
      if (reader) { const decoder = new TextDecoder(); while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 2000000) { await reader.cancel(); throw new Error(); } raw += decoder.decode(part.value, { stream: true }); } raw += decoder.decode(); }
      else raw = await response.text();
      if (raw.length > 2000000) throw new Error();
      return JSON.parse(raw);
    } catch (error) {
      if (error instanceof SocialError) throw error;
      throw new SocialError(502, method === 'GET' ? 'Social provider is temporarily unavailable.' : 'Reply outcome is uncertain. Refresh the thread and check the platform before retrying.', method !== 'GET');
    } finally { clearTimeout(timeout); }
  };
}

export async function handleSocial(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const caller = await authorize(req);
    const action = req.query.action === undefined ? 'status' : scalar(req.query.action);
    const methods: Record<string, string> = { status: 'GET', accounts: 'GET', analytics: 'GET', inbox: 'GET', message: 'GET', createDraft: 'POST', updateDraft: 'PATCH', sendReply: 'POST', discardDraft: 'DELETE' };
    if (!methods[action]) fail(400, 'Unknown social action.');
    if (req.method !== methods[action]) { res.setHeader('Allow', methods[action]); fail(405, `${methods[action]} required.`); }
    let key = process.env.BRIGHTBEAN_API_KEY || '';
    if (!key) { const { data, error } = await caller.admin.from('app_settings').select('setting_value').eq('setting_key', 'BRIGHTBEAN_API_KEY').maybeSingle(); if (error) fail(503, 'Social configuration is temporarily unavailable.'); key = typeof data?.setting_value === 'string' ? data.setting_value : ''; }
    if (!key) { if (action === 'status') return res.json({ success: true, configured: false, accounts: [] }); fail(503, 'Social provider is not configured.'); }
    const upstream = providerClient(providerOrigin(), key, res);
    const scope = await upstream('/me/');
    if (!socialUuid.test(scope?.workspace_id) || !Array.isArray(scope?.permissions) || !Array.isArray(scope?.allowlisted_accounts)) fail(502, 'Social provider scope is unavailable.');
    const permitted = new Set(scope.permissions.filter((value: unknown) => typeof value === 'string'));
    const accountIds = new Set(scope.allowlisted_accounts.map((row: any) => row?.id).filter((id: unknown) => typeof id === 'string' && socialUuid.test(id)));
    const requirePermission = (permission: string) => { if (!permitted.has(permission)) fail(403, `Social provider requires ${permission} permission.`); };
    const inScope = (row: any) => row?.workspace_id === scope.workspace_id && accountIds.has(row?.social_account_id);
    const readMessage = async (id: string) => { const row = await upstream(`/inbox/${id}`); if (row?.id !== id || !inScope(row) || !projectMessage(row)) fail(404, 'Social message is unavailable.'); return row; };
    if (['status', 'accounts'].includes(action)) {
      const result = await upstream('/accounts/');
      if (!Array.isArray(result?.accounts)) fail(502, 'Social accounts are unavailable.');
      const accounts = result.accounts.filter((row: any) => accountIds.has(row.id)).slice(0, 100).map((row: any) => ({ id: row.id, platform: socialText(row.platform, 40), account_name: socialText(row.account_name), account_handle: socialText(row.account_handle), connection_status: ['connected', 'token_expiring', 'disconnected', 'error'].includes(row.connection_status) ? row.connection_status : 'error' }));
      return res.json({ success: true, configured: true, workspace: socialText(scope.workspace_name), permissions: [...permitted], accounts, apiError: null });
    }
    if (action === 'analytics') {
      requirePermission('view_analytics'); const id = validId(req.query.account_id); if (!accountIds.has(id)) fail(403, 'Social account is outside the configured scope.');
      const days = ['7', '30', '90'].includes(scalar(req.query.days)) ? scalar(req.query.days) : '30';
      const result = await upstream(`/analytics/accounts/${id}?days=${days}`);
      const metric = (row: any) => ({ key: socialText(row?.key, 50), label: socialText(row?.label, 100), kind: ['count', 'percent', 'minutes'].includes(row?.kind) ? row.kind : 'count', value: Number.isFinite(row?.value) ? row.value : 0, delta: Number.isFinite(row?.delta) ? row.delta : null });
      return res.json({ success: true, analytics: { analytics_available: result?.analytics_available === true, unavailable_reason: socialText(result?.unavailable_reason, 300), hero_metrics: Array.isArray(result?.hero_metrics) ? result.hero_metrics.slice(0, 10).map(metric) : [], engagement: { rate: result?.engagement?.rate ? metric(result.engagement.rate) : null } } });
    }
    requirePermission('use_inbox');
    if (action === 'inbox') {
      const query = new URLSearchParams({ limit: '25' });
      if (req.query.cursor !== undefined) { const cursor = scalar(req.query.cursor); if (!cursor || cursor.length > 256 || !/^[A-Za-z0-9_+=\/-]+$/.test(cursor)) fail(400, 'Invalid social page cursor.'); query.set('cursor', cursor); }
      if (req.query.account_id !== undefined) { const id = validId(req.query.account_id); if (!accountIds.has(id)) fail(403, 'Social account is outside the configured scope.'); query.set('social_account_id', id); }
      const result = await upstream(`/inbox/?${query}`);
      if (!Array.isArray(result?.messages) || result.messages.length > 25 || (result.next_cursor !== null && (typeof result.next_cursor !== 'string' || result.next_cursor.length > 256))) fail(502, 'Social inbox response is unavailable.');
      if (result.messages.some((row: any) => !inScope(row) || !projectMessage(row))) fail(502, 'Social inbox scope could not be verified.');
      return res.json({ success: true, items: result.messages.map(projectMessage), nextCursor: result.next_cursor, canReply: permitted.has('reply_from_inbox') });
    }
    const input = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const messageId = validId(action === 'message' ? req.query.message_id : input.message_id);
    const message = await readMessage(messageId);
    if (action === 'message') return res.json({ success: true, item: projectMessage(message), canReply: permitted.has('reply_from_inbox') });
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail(415, 'JSON required.');
    const body = typeof input.body === 'string' ? input.body : '';
    if (['createDraft', 'updateDraft'].includes(action) && (!body.trim() || body.length > 10000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body))) fail(400, 'Reply must contain 1–10,000 plain-text characters.');
    if (action === 'createDraft') {
      const requestId = validId(input.request_id);
      // Provider persists the claim and rejects a changed body for the same retry identity.
      const idempotency_key = `follops-${createHash('sha256').update(JSON.stringify([caller.id, messageId, requestId])).digest('hex')}`;
      const reply = projectReply(await upstream(`/inbox/${messageId}/replies`, 'POST', { body, send: false, idempotency_key }));
      if (!reply || reply.messageId !== messageId) throw new SocialError(502, 'Draft outcome is uncertain. Refresh before continuing.', true);
      return res.json({ success: true, reply });
    }
    const replyId = validId(input.reply_id);
    const reply = Array.isArray(message.replies) ? message.replies.find((row: any) => row.id === replyId && row.inbox_message_id === messageId) : null;
    if (!reply) fail(404, 'Social reply is unavailable.');
    if (action === 'sendReply') {
      requirePermission('reply_from_inbox');
      if (reply.status === 'sent') return res.json({ success: true, reply: projectReply(reply) });
      if (!message.reply_eligibility || message.reply_eligibility.can_send !== true) fail(409, 'Platform reply is currently unavailable. Refresh the thread to check its reply window.');
      if (reply.status === 'failed' && input.confirm_retry !== true) fail(409, 'Check the platform for a previous delivery before explicitly retrying this failed reply.');
      if (!['draft', 'failed'].includes(reply.status)) fail(409, 'Reply cannot be sent in its current state.');
      const sent = projectReply(await upstream(`/inbox/replies/${replyId}/send`, 'POST', {}));
      if (!sent || sent.messageId !== messageId || sent.id !== replyId || sent.status !== 'sent') throw new SocialError(502, 'Reply outcome is uncertain. Refresh before continuing.', true);
      return res.json({ success: true, reply: sent });
    }
    if (!['draft', 'failed'].includes(reply.status)) fail(409, 'Only draft or failed replies can be changed.');
    if (action === 'discardDraft') { await upstream(`/inbox/replies/${replyId}`, 'DELETE'); return res.json({ success: true }); }
    const updated = projectReply(await upstream(`/inbox/replies/${replyId}`, 'PATCH', { body }));
    if (!updated || updated.id !== replyId || updated.messageId !== messageId) throw new SocialError(502, 'Draft outcome is uncertain. Refresh before continuing.', true);
    return res.json({ success: true, reply: updated });
  } catch (error) {
    const safe = error instanceof SocialError ? error : new SocialError(503, 'Social access is temporarily unavailable.');
    if (safe.status === 429) res.setHeader('Retry-After', safe.retryAfter);
    return res.status(safe.status).json({ success: false, error: safe.message, uncertain: safe.uncertain });
  }
}
