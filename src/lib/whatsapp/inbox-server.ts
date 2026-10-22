import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validChatId, validMessageId } from './inbox.js';
import { handlePhoneLabels } from './phone-labels-server.js';

class InboxError extends Error { constructor(public status: number, message: string) { super(message); } }
const requests = new Map<string, { since: number; count: number }>();
const fail = (status: number, message: string): never => { throw new InboxError(status, message); };
export async function handleWhatsAppInbox(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const action = req.query.action;
    if ((action === 'phoneLabels' && req.method !== 'GET') || (action !== 'phoneLabels' && req.method !== 'POST')) fail(405, 'Unsupported request method.');
    if (req.method === 'POST' && !/^application\/json(?:;|$)/i.test(String(req.headers['content-type'] || ''))) fail(415, 'JSON required.');
    if (req.method === 'POST' && JSON.stringify(req.body || {}).length > 65536) fail(413, 'Inbox request is too large.');
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer \S+$/.test(header) || header.length > 8192) fail(401, 'Authentication required.');
    const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !anon || !secret) fail(503, 'WhatsApp inbox controls are unavailable.');
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const auth = createClient(url!, anon!, options); const admin = createClient(url!, secret!, options);
    const { data, error } = await auth.auth.getUser(header!.slice(7));
    if (error || !data?.user) fail(401, 'Invalid or expired session.');
    const { data: profile, error: profileError } = await admin.from('user_profiles').select('id,role,is_active').eq('id', data!.user!.id).eq('is_active', true).maybeSingle();
    if (profileError) fail(503, 'WhatsApp inbox controls are unavailable.');
    if (!profile || profile.id !== data!.user!.id || !['owner', 'manager'].includes(profile.role) || profile.is_active !== true) fail(403, 'Inbox label and read controls require an active owner or manager.');
    const now = Date.now();
    for (const [id, bucket] of requests) if (now - bucket.since > 60000) requests.delete(id);
    if (requests.size >= 1000 && !requests.has(profile.id)) fail(429, 'Inbox request limit reached.');
    const bucket = requests.get(profile.id) || { since: now, count: 0 };
    bucket.count++; requests.set(profile.id, bucket);
    if (bucket.count > 120) { res.setHeader('Retry-After', '60'); fail(429, 'Inbox request limit reached. Try again later.'); }
    if (['phoneLabels','phoneAssignments','phoneLabelChange'].includes(String(action))) return handlePhoneLabels(req,res,admin);
    if (action === 'inboxUnread') {
      const ids = req.body?.chatIds;
      if (!Array.isArray(ids) || ids.length > 500 || !ids.every(validChatId)) fail(400, 'Provide at most 500 valid chat IDs.');
      const { data: rows, error: rpcError } = await admin.rpc('wa_inbox_unread', { p_actor: profile.id, p_chats: [...new Set(ids)] });
      if (rpcError) fail(503, 'CRM unread tracking is unavailable. The reviewed database migration may still be pending.');
      return res.json({ success: true, counts: rows || [], scope: 'per-user-crm' });
    }
    if (action === 'inboxSeen') {
      const { chatId, messageIds } = req.body || {};
      if (!validChatId(chatId) || !Array.isArray(messageIds) || !messageIds.length || messageIds.length > 1000 || !messageIds.every(validMessageId)) fail(400, 'Provide a valid chat and up to 1000 displayed message IDs.');
      const { error: rpcError } = await admin.rpc('wa_inbox_seen', { p_actor: profile.id, p_chat: chatId, p_messages: [...new Set(messageIds)] });
      if (rpcError) fail(503, 'Could not save CRM read state. Refresh before relying on the unread count.');
      return res.json({ success: true });
    }
    fail(400, 'Unknown inbox action.');
  } catch (error) {
    return res.status(error instanceof InboxError ? error.status : 503).json({ success: false, error: error instanceof InboxError ? error.message : 'WhatsApp inbox controls are temporarily unavailable.' });
  }
}
