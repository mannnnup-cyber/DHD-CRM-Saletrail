import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

async function resolveContact(sb: any, opts: { name: string; phone?: string; source: string }): Promise<string | null> {
  const phoneNorm = (opts.phone || '').replace(/[^\d]/g, '');
  if (phoneNorm) {
    const { data } = await sb.from('contacts').select('id').eq('phone_normalized', phoneNorm).limit(1).single();
    if (data) return data.id;
  }
  const { data, error } = await sb.from('contacts').insert({ name: opts.name || 'Unknown', phone: opts.phone || null, phone_normalized: phoneNorm || null, source: opts.source, status: 'NEW' }).select('id').single();
  if (error) { console.error('[whatsapp] resolveContact error:', error.message); return null; }
  return data.id;
}

// Self-contained Supabase client for Node.js — does NOT import from src/lib/supabase
// (that file uses import.meta.env which is Vite-only and crashes in serverless)

const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 5-minute in-memory cache for release info
let _releaseCache: { fetchedAt: number; version: string | null; downloadUrl: string; publishedAt: string | null } | null = null;

async function fetchLatestRelease(): Promise<{ version: string | null; downloadUrl: string; publishedAt: string | null }> {
  if (_releaseCache && Date.now() - _releaseCache.fetchedAt < 5 * 60 * 1000) {
    return _releaseCache;
  }
  // Primary: read from Supabase app_settings (written by CI on each release)
  if (supabase) {
    try {
      const [vRow, uRow] = await Promise.all([
        supabase.from('app_settings').select('setting_value').eq('setting_key', 'COMPANION_APP_VERSION').maybeSingle(),
        supabase.from('app_settings').select('setting_value').eq('setting_key', 'COMPANION_APP_DOWNLOAD_URL').maybeSingle(),
      ]);
      const version = vRow?.data?.setting_value ?? null;
      const downloadUrl = uRow?.data?.setting_value ?? 'https://github.com/mannnnup-cyber/DHD-CRM-Companion/releases/latest';
      if (version) {
        const result = { version, downloadUrl, publishedAt: null };
        _releaseCache = { fetchedAt: Date.now(), ...result };
        return result;
      }
    } catch { /* fall through to hardcoded fallback */ }
  }
  if (_releaseCache) return _releaseCache;
  return { version: null, downloadUrl: 'https://github.com/mannnnup-cyber/DHD-CRM-Companion/releases/latest', publishedAt: null };
}

let supabase: any = null;
try {
  if (_supabaseUrl && _supabaseKey) {
    supabase = createClient(_supabaseUrl, _supabaseKey);
    console.log('[Supabase Init] ✓ CREATED successfully');
  } else {
    console.log('[Supabase Init] ✗ CANNOT CREATE - Missing credentials');
  }
} catch (err: any) {
  console.error('[Supabase Init Error]:', err?.message || err);
  supabase = null;
}

console.log('[Supabase Init] URL:', _supabaseUrl ? '✓ ' + _supabaseUrl.substring(0, 30) : '✗ MISSING', 'Key:', _supabaseKey ? '✓ set (length: ' + _supabaseKey.length + ')' : '✗ MISSING', 'Client:', supabase ? '✓ CREATED' : '✗ NULL');

const supaDb = {
  createCall: async (call: any) => {
    if (!supabase) return;
    await supabase.from('calls').insert(call);
  }
};

// Evolution API configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:3001';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// Helper to get a setting from Supabase with caching
const _settingCache: Record<string, { value: string; ts: number }> = {};
const SETTING_CACHE_TTL = 5000; // 5 seconds (reduced for provider switching)

async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  // Check cache
  const cached = _settingCache[key];
  if (cached && Date.now() - cached.ts < SETTING_CACHE_TTL) {
    return cached.value;
  }

  // Query Supabase
  if (!supabase) return defaultValue;

  try {
    const { data, error: _error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    const value = data?.setting_value || defaultValue;
    _settingCache[key] = { value, ts: Date.now() };
    return value;
  } catch (err) {
    console.error(`[whatsapp] getSetting(${key}) error:`, err);
    return defaultValue;
  }
}

// Helper to save a setting to Supabase
async function setSetting(key: string, value: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' });

    if (error) {
      console.error(`[whatsapp] setSetting(${key}) error:`, error.message);
      return false;
    }

    // Update cache
    _settingCache[key] = { value, ts: Date.now() };
    return true;
  } catch (err) {
    console.error(`[whatsapp] setSetting(${key}) error:`, err);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle webhook POST from WhatsApp providers (Green API or Evolution API)
  if (req.method === 'POST' && !req.query.action) {
    const body = req.body;

    console.log('[WEBHOOK RECEIVED] Method:', req.method, 'Has action:', !!req.query.action);
    console.log('[WEBHOOK BODY] Keys:', Object.keys(body), 'Event:', body.event, 'typeWebhook:', body.typeWebhook);

    try {
      // Detect provider and extract message data
      let provider = 'evolution';
      let typeWebhook = '';
      let isInbound = false;
      let chatId = '';
      let senderName = '';
      let messageId = '';
      let timestamp = 0;
      let text = '';
      let msgType = 'textMessage';

      // ===== EVOLUTION API WEBHOOK FORMAT =====
      if (body?.event) {
        // Evolution API uses 'event' field (Baileys-based)
        provider = 'evolution';
        // Normalize event: MESSAGES_UPSERT → messages.upsert
        const rawEvent = body.event as string;
        typeWebhook = rawEvent.toLowerCase().replace(/_/g, '.').replace('messages.upsert', 'messages.upsert');

        if (typeWebhook === 'messages.upsert') {
          // ---- Evolution API v2 format (most common) ----
          // body.data is the message object directly, with nested 'key'
          // body.data.key.remoteJid = chat ID
          // body.data.key.id = message ID
          // body.data.key.fromMe = direction
          // body.data.message.conversation = text
          if (body.data?.key?.remoteJid) {
            chatId = body.data.key.remoteJid || '';
            isInbound = !body.data.key.fromMe;
            messageId = body.data.key.id || '';
            senderName = body.data.pushName || '';
            timestamp = body.data.messageTimestamp || Math.floor(Date.now() / 1000);

            // Extract text from nested message object
            const msgObj = body.data.message || {};
            text = msgObj.conversation ||
                   msgObj.extendedTextMessage?.text ||
                   msgObj.imageMessage?.caption ||
                   msgObj.videoMessage?.caption ||
                   msgObj.documentMessage?.caption ||
                   body.data.body || body.data.text || '';
            if (!text && body.data.messageType) text = `[${body.data.messageType}]`;
            msgType = body.data.messageType || 'conversation';

            console.log('[Webhook] Evolution v2 format (key.remoteJid):', { chatId, messageId, isInbound, text: text?.substring(0, 50) });
          } else {
            // ---- Fallback: array / older format ----
            const message = body.data?.messages?.[0] || (Array.isArray(body.data) ? body.data[0] : null);

            if (message) {
              isInbound = !message.fromMe;
              chatId = message.chatId || message.from || message.remoteJid || message.key?.remoteJid || '';
              senderName = message.pushName || body.data?.contacts?.[0]?.pushName || '';
              messageId = message.id || message.key?.id || '';
              timestamp = message.messageTimestamp || message.timestamp || Math.floor(Date.now() / 1000);

              text = message.body || message.text || message.conversation || '';
              if (!text && message.message?.conversation) text = message.message.conversation;
              if (!text && message.caption) text = message.caption;
              if (!text && message.messageType) text = `[${message.messageType}]`;
              if (!text && message.type) text = `[${message.type}]`;

              msgType = message.messageType || message.type || 'text';

              console.log('[Webhook] Evolution array format:', { chatId, messageId, isInbound, text: text?.substring(0, 50) });
            }
          }
        }
      }

      // Only store actual messages — ignore state/ack events
      if (typeWebhook === 'messages.upsert') {

        console.log('[Webhook] Pre-save check:', {
          provider,
          typeWebhook,
          supabaseConnected: supabase !== null,
          chatId,
          messageId,
          isInbound,
          willSave: supabase !== null && chatId && messageId
        });

        if (supabase !== null && chatId && messageId) {
          // Idempotency check: use provider_message_id to prevent duplicates
          const { data: existing } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('provider_message_id', messageId)
            .eq('provider', provider)
            .limit(1);

          if (!existing || existing.length === 0) {
            // Extract phone number from chatId
            let phone = null;
            if (isInbound) {
              // Green API: chatId = "55119999999@c.us" → "55119999999"
              // Evolution: chatId = "55119999999@s.whatsapp.net" → "55119999999"
              phone = chatId.replace(/@[^@]+$/, '');
            }

            const contactId = (isInbound && phone && supabase !== null)
              ? await resolveContact(supabase, { name: senderName || phone, phone, source: 'WHATSAPP' })
              : null;

            // Evolution API sends timestamp in seconds; JS Date needs milliseconds
            const msgAt = timestamp
              ? new Date(timestamp > 1e10 ? timestamp : timestamp * 1000).toISOString()
              : new Date().toISOString();

            // Extract media URL from Evolution API message format
            // Evolution API uses 'url' (not 'downloadUrl') on the media message sub-object
            let mediaUrl = null;
            if (body.data?.message) {
              const msg = body.data.message;
              mediaUrl =
                msg.imageMessage?.url || msg.imageMessage?.downloadUrl ||
                msg.videoMessage?.url || msg.videoMessage?.downloadUrl ||
                msg.audioMessage?.url || msg.audioMessage?.downloadUrl ||
                msg.pttMessage?.url || msg.pttMessage?.downloadUrl ||
                msg.documentMessage?.url || msg.documentMessage?.downloadUrl ||
                msg.stickerMessage?.url || msg.stickerMessage?.downloadUrl ||
                null;
            }

            const { data: inserted } = await supabase.from('whatsapp_messages').insert({
              provider,
              provider_message_id: messageId,
              chat_id: chatId,
              sender_name: senderName,
              direction: isInbound ? 'inbound' : 'outbound',
              body: text,
              message_type: msgType,
              media_url: mediaUrl,
              raw: body,
              contact_id: contactId ?? null,
              created_at: msgAt
            }).select('id').single();

            if (contactId && inserted) {
              await supabase.from('interactions').insert({
                contact_id: contactId,
                type: 'WHATSAPP',
                direction: isInbound ? 'INBOUND' : 'OUTBOUND',
                content: text.slice(0, 500),
                metadata: { whatsapp_message_id: inserted.id, provider_message_id: messageId, chat_id: chatId, provider },
                timestamp: msgAt,
              });
            }
          }
        }
      }

      // Handle CALL events (Evolution API)
      // Evolution API CALL event payload uses 'from' (not 'remoteJid') for the caller JID.
      // Also handle 'calls.upsert' event name variant from newer Evolution builds.
      if (provider === 'evolution' && (typeWebhook === 'call' || typeWebhook === 'calls.upsert')) {
        // Evolution API v2 CALL payload: { event:'CALL', data:{ id, from, callType, status, timestamp, duration } }
        const callData = body.data || body;
        const rawCallerId = callData.from || callData.remoteJid || callData.chatId || '';
        console.log('[Webhook] CALL event received:', { from: rawCallerId, callType: callData.callType, status: callData.status, raw: callData });

        if (supabase !== null && rawCallerId) {
          const callChatId = rawCallerId;
          const callId = callData.id || callData.callId || `${callChatId}_${Date.now()}`;
          const callType = callData.callType || callData.type || 'voice'; // 'voice' or 'video'
          const callStatus = callData.status || callData.callStatus || 'missed'; // 'answered', 'missed', 'rejected'
          const rawTs = callData.timestamp || callData.date || callData.dateTime;
          const callStarted = rawTs ? new Date(rawTs * 1000).toISOString() : new Date().toISOString();
          const rawEnd = callData.endedAt || callData.endAt;
          const callEnded = rawEnd ? new Date(rawEnd * 1000).toISOString() : null;
          const callDuration = callData.duration || callData.durationSeconds || 0; // seconds

          // Idempotency check
          const { data: existingCall } = await supabase
            .from('whatsapp_calls')
            .select('id')
            .eq('provider_call_id', callId)
            .eq('provider', provider)
            .limit(1);

          if (!existingCall || existingCall.length === 0) {
            const { data: inserted, error: insertError } = await supabase
              .from('whatsapp_calls')
              .insert({
                provider: 'evolution',
                provider_call_id: callId,
                chat_id: callChatId,
                call_type: callType,
                status: callStatus,
                duration_seconds: callDuration,
                started_at: callStarted,
                ended_at: callEnded
              })
              .select('id');

            if (insertError) {
              console.error('[Webhook] Failed to insert call:', insertError);
            } else {
              console.log('[Webhook] Call logged:', { callId, chatId: callChatId, status: callStatus, duration: callDuration });

              // Optional: Create interaction record for CRM
              if (inserted && inserted.length > 0) {
                const chatPhone = callChatId.replace(/@[a-z.]+$/, '');
                const contactResult = await resolveContact(supabase, { phone: chatPhone, name: callChatId, source: 'WHATSAPP' });

                if (contactResult) {
                  const interactionType = callType === 'video' ? 'VIDEOCALL' : 'CALL';
                  const interactionContent = `${callStatus === 'answered' ? 'Answered' : 'Missed'} ${callType} call - ${callDuration}s`;

                  await supabase.from('interactions').insert({
                    contact_id: contactResult,
                    type: interactionType,
                    direction: 'INBOUND',
                    content: interactionContent,
                    metadata: { call_id: callId, status: callStatus, duration: callDuration },
                    timestamp: callStarted
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }

    return res.status(200).json({ success: true });
  }

  const action = req.query.action as string;

  try {
    switch (action) {

      case 'status': {
        // Check Evolution API connection status.
        // Strategy: try Evolution API connectionState first, then fall back to
        // checking for recent DB messages (if webhook is delivering, we're connected).
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');

        // Helper: check recent DB activity as proof of connection
        const hasRecentMessages = async (): Promise<boolean> => {
          if (!supabase) return false;
          try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days
            const { count } = await supabase
              .from('whatsapp_messages')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', since);
            return (count || 0) > 0;
          } catch { return false; }
        };

        // If no instance name configured, check DB as last resort
        if (!instanceName) {
          const active = await hasRecentMessages();
          return res.json({ success: true, connected: active, state: active ? 'db_active' : 'not_linked' });
        }

        // Try Evolution API status check
        if (EVOLUTION_API_URL) {
          try {
            const stateUrl = new URL(`/instance/${instanceName}/connectionState`, EVOLUTION_API_URL).toString();
            const stateRes = await fetch(stateUrl, {
              method: 'GET',
              headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {},
              signal: AbortSignal.timeout(15000) // 15s timeout (Railway cold start can be slow)
            });

            if (stateRes.ok) {
              const data = await stateRes.json();
              const state = data?.instance?.state || data?.state || 'unknown';
              // Evolution API states: 'open' = connected, 'close'/'connecting' = not
              const connected = state === 'open' || state === 'connected';
              return res.json({ success: true, connected, state, instanceName });
            }
          } catch (err: any) {
            console.warn('[status] Evolution API check failed:', err.message, '— falling back to DB check');
          }
        }

        // Fallback: if we have recent messages, webhook is working → consider connected
        // Empty DB (e.g. after a fresh wipe) does NOT mean disconnected — return null (unknown)
        const active = await hasRecentMessages();
        return res.json({
          success: true,
          connected: active ? true : null, // null = unknown, don't show red banner
          state: active ? 'webhook_active' : 'unknown',
          instanceName
        });
      }

      case 'webhookInfo': {
        // Return webhook configuration info for Evolution API
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        const webhookUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/whatsapp`;

        if (!instanceName || !EVOLUTION_API_URL) {
          return res.json({ success: true, configured: false, url: '', message: 'Not configured' });
        }

        try {
          const webhookCheckUrl = new URL(`/webhook/find/${instanceName}`, EVOLUTION_API_URL).toString();
          const r = await fetch(webhookCheckUrl, {
            headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}
          });
          if (r.ok) {
            const data = await r.json();
            const currentUrl = data?.url || data?.webhook?.url || '';
            return res.json({
              success: true,
              configured: !!currentUrl,
              url: currentUrl,
              webhookUrl
            });
          }
        } catch (e) { /* ignore */ }

        return res.json({ success: true, configured: false, url: '', webhookUrl });
      }

      case 'setWebhook': {
        // Set webhook for Evolution API
        const { webhookUrl } = req.body;
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        try {
          const webhookSetUrl = new URL(`/webhook/set/${instanceName}`, EVOLUTION_API_URL).toString();
          const events = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'CALL'];

          const finalWebhookUrl = webhookUrl || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/whatsapp`;
          const r = await fetch(webhookSetUrl, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              webhook: {
                url: finalWebhookUrl,
                events,
                enabled: true,
                webhookByEvents: false,
                webhookBase64: false
              }
            })
          });

          const data = await r.json();
          if (!r.ok) {
            const errDetail = data?.message || data?.error || data?.response?.message || JSON.stringify(data).slice(0, 200);
            console.error('[setWebhook] Evolution API error:', r.status, errDetail);
            return res.json({ success: false, error: `Evolution API ${r.status}: ${errDetail}` });
          }
          return res.json({ success: true, data, message: 'Webhook configured successfully' });
        } catch (err: any) {
          console.error('[Evolution setWebhook] Error:', err.message);
          return res.json({ success: false, error: err.message });
        }
      }

      case 'chats': {
        // Return chats from database (provider-agnostic)
        // The database stores all messages from both providers
        if (supabase === null) {
          return res.status(400).json({ success: false, error: 'Database not configured' });
        }

        try {
          const { data: msgs } = await supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false }).limit(500);
          const byChat: Record<string, any> = {};
          (msgs || []).forEach((m: any) => {
            const chat = m.chat_id || m.from || m.to || 'unknown';
            if (!byChat[chat]) byChat[chat] = { id: chat, name: chat, lastMessage: m.body || '', timestamp: m.created_at, unread: 0, phone: chat, status: 'active' };
            if (new Date(m.created_at) > new Date(byChat[chat].timestamp)) {
              byChat[chat].lastMessage = m.body || '';
              byChat[chat].timestamp = m.created_at;
            }
          });

          const chats = Object.values(byChat).slice(0, 200);
          return res.json({ success: true, chats, source: 'db' });
        } catch (err) {
          console.error('chats error', err);
          return res.status(400).json({ success: false, error: String(err) });
        }
      }

      case 'chatsFromDb': {
        // Read recent chats aggregated from whatsapp_messages table, filtered by active provider
        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
        }

        try {
          // Use DB function to get ONE row per chat (latest message) — no memory-based grouping limit
          // This correctly returns ALL chats regardless of total message volume
          const { data: filteredMsgs, error: fnError } = await supabase
            .rpc('get_chats_from_messages', { provider_filter: 'evolution' });

          if (fnError) {
            console.error('[chatsFromDb] RPC error:', fnError);
            return res.json({ success: false, error: fnError.message });
          }

          // Load persisted chat metadata (status, assignedTo, contact_name for @lid resolution)
          const { data: chatMeta } = await supabase
            .from('whatsapp_chats')
            .select('chat_id, status, assigned_to, assigned_to_user_id, contact_name');
          const metaMap: Record<string, any> = {};
          (chatMeta || []).forEach((row: any) => { metaMap[row.chat_id] = row; });

          // Collect best known name per chat:
          // Priority: contact_name from whatsapp_chats > sender_name from inbound messages
          const chatNames: Record<string, string> = {};
          // First apply contact_name from DB (covers @lid resolution)
          (chatMeta || []).forEach((row: any) => {
            if (row.contact_name) chatNames[row.chat_id] = row.contact_name;
          });
          // Then fill gaps from inbound message sender_name
          filteredMsgs.forEach((m: any) => {
            const chatId = m.chat_id || 'unknown';
            if (!chatNames[chatId] && m.direction === 'inbound' && m.sender_name) {
              chatNames[chatId] = m.sender_name;
            }
          });

          // Build chat list — one entry per unique chat_id, newest message wins
          const byChat: Record<string, any> = {};
          filteredMsgs.forEach((m: any) => {
            const chatId = m.chat_id || 'unknown';
            // Strip @suffix for display phone number, handle @lid format gracefully
            const phone = chatId.includes('@') ? chatId.replace(/@[^@]+$/, '') : chatId;
            const displayName = chatNames[chatId] || phone || chatId;

            const meta = metaMap[chatId];
            if (!byChat[chatId]) {
              byChat[chatId] = {
                id: chatId,
                name: displayName,
                lastMessage: m.body || '',
                timestamp: m.created_at,
                unread: 0,
                phone,
                status: meta?.status || 'active',
                assignedTo: meta?.assigned_to || 'Unassigned',
                assignedToUserId: meta?.assigned_to_user_id || null
              };
            } else {
              // Update name if we now have a better one
              if (chatNames[chatId] && byChat[chatId].name === phone) {
                byChat[chatId].name = chatNames[chatId];
              }
              // Keep newest message (list is DESC so first seen = newest)
            }
          });

          const chats = Object.values(byChat)
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          // No slice — return all chats (DB function already deduplicates efficiently)
          return res.json({ success: true, chats, source: 'db' });
        } catch (err) {
          console.error('chatsFromDb error', err);
          return res.json({ success: false, error: String(err) });
        }
      }

      case 'messages': {
        // Get chat messages from database
        const chatId = req.query.chatId as string;
        if (!supabase || !chatId) {
          return res.status(400).json({ success: false, error: 'chatId required' });
        }

        try {
          const { data: msgs } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })
            .limit(1000);

          const formatted = (msgs || []).map((m: any) => ({
            id: m.provider_message_id || m.id,
            text: m.body || '',
            timestamp: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : 0,
            fromMe: m.direction === 'outbound',
            status: 'read',
            type: m.message_type || m.type || 'text', // message_type is new col; fall back to legacy 'type'
            mediaUrl: m.media_url || null
          }));

          return res.json({ success: true, messages: formatted });
        } catch (err: any) {
          console.error('messages error:', err.message);
          return res.status(500).json({ success: false, error: err.message });
        }
      }

      case 'messageCount': {
        if (supabase === null) return res.json({ success: true, count: 0 });
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('whatsapp_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound')
          .gte('created_at', startOfMonth.toISOString());
        return res.json({ success: true, count: count || 0 });
      }

      case 'mediaProxy': {
        const mediaUrl = req.query.url as string;
        const msgId = req.query.msgId as string; // Evolution API message ID (provider_message_id)

        // --- msgId mode: fetch media via Evolution API's base64 decode endpoint ---
        // WhatsApp media URLs are encrypted CDN links; Evolution API decrypts them
        // using the mediaKey stored in the raw message. This is the reliable path.
        if (msgId && !mediaUrl) {
          if (supabase === null) return res.status(500).json({ error: 'Supabase not configured' });
          const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName || !EVOLUTION_API_URL) {
            return res.status(500).json({ error: 'Evolution API not configured' });
          }

          // Load the raw message from DB (we need the full Baileys message object for decryption)
          // Try provider_message_id first; fall back to row UUID id
          let { data: msgRow } = await supabase
            .from('whatsapp_messages')
            .select('raw, media_url')
            .eq('provider_message_id', msgId)
            .maybeSingle();

          if (!msgRow) {
            // msgId might be the Supabase row UUID
            const { data: fallback } = await supabase
              .from('whatsapp_messages')
              .select('raw, media_url')
              .eq('id', msgId)
              .maybeSingle();
            msgRow = fallback;
          }

          if (!msgRow?.raw) {
            // Last resort: try direct URL proxy with stored media_url
            if (msgRow?.media_url) {
              return res.redirect(307, `/api/whatsapp?action=mediaProxy&url=${encodeURIComponent(msgRow.media_url)}`);
            }
            console.error('[mediaProxy/msgId] Message not found in DB:', msgId);
            return res.status(404).json({ error: 'Message not found' });
          }

          // Evolution API v2: POST /chat/getBase64FromMediaMessage/{instance}
          // Body: { message: <full baileys message object> }
          const b64Url = new URL(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, EVOLUTION_API_URL).toString();
          try {
            const rawMsg = msgRow.raw?.data || msgRow.raw; // handle {event, data:msg} or plain msg
            const r = await fetch(b64Url, {
              method: 'POST',
              headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: rawMsg, convertToMp4: false }),
              signal: AbortSignal.timeout(20000)
            });

            if (!r.ok) {
              console.error('[mediaProxy/msgId] Evolution API error:', r.status, await r.text().catch(() => ''));
              return res.status(r.status).json({ error: `Evolution API returned ${r.status}` });
            }

            const rData = await r.json();
            // Response may be: { base64: "data:image/jpeg;base64,..." } or { base64: "raw..." }
            const b64Raw: string = rData.base64 || rData.data?.base64 || '';
            if (!b64Raw) {
              console.error('[mediaProxy/msgId] No base64 in response:', JSON.stringify(rData).slice(0, 200));
              return res.status(404).json({ error: 'No media data in Evolution API response' });
            }

            // Match full MIME type including codec params: data:audio/ogg; codecs=opus;base64,...
            const match = b64Raw.match(/^data:([^,]+);base64,(.+)$/s);
            let mimeType = 'application/octet-stream';
            let b64Data = b64Raw;
            if (match) {
              // match[1] = "audio/ogg; codecs=opus"  match[2] = base64 data
              mimeType = match[1].trim();
              b64Data = match[2];
            }
            // Normalize OGG audio MIME for broad browser support
            if (mimeType.startsWith('audio/ogg')) mimeType = 'audio/ogg';
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', 'inline'); // stream in <audio>/<img>, don't download
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(Buffer.from(b64Data, 'base64'));
          } catch (err: any) {
            console.error('[mediaProxy/msgId] Error:', err.message);
            return res.status(500).json({ error: err.message });
          }
        }

        // --- URL mode: direct proxy (for avatars, locally-stored media, etc.) ---
        if (!mediaUrl) return res.status(400).json({ error: 'url or msgId required' });
        let parsed: URL;
        try { parsed = new URL(mediaUrl); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
        // Allow both https and http (Evolution API on Railway uses http internally)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return res.status(400).json({ error: 'HTTP/HTTPS only' });
        }

        // If the media URL is from the Evolution API server, add the API key header
        const isEvolutionUrl = EVOLUTION_API_URL && mediaUrl.startsWith(EVOLUTION_API_URL);
        const headers: Record<string, string> = {};
        if (isEvolutionUrl && EVOLUTION_API_KEY) {
          headers['apikey'] = EVOLUTION_API_KEY;
        }

        try {
          const mr = await fetch(mediaUrl, { headers });
          if (!mr.ok) {
            console.error('[mediaProxy] Fetch failed:', mr.status, mediaUrl);
            return res.status(mr.status).json({ error: `Media fetch failed: ${mr.status}` });
          }
          const ct = mr.headers.get('content-type') || 'application/octet-stream';
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const buf = await mr.arrayBuffer();
          return res.send(Buffer.from(buf));
        } catch (err: any) {
          console.error('[mediaProxy] Error:', err.message, mediaUrl);
          return res.status(500).json({ error: err.message });
        }
      }

      case 'sendReaction': {
        const { chatId, messageId, fromMe, reaction } = req.body;
        if (!chatId || !messageId || reaction === undefined) {
          return res.status(400).json({ success: false, error: 'chatId, messageId, and reaction are required' });
        }
        const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }
        const url = new URL(`/message/sendReaction/${instanceName}`, EVOLUTION_API_URL).toString();
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: { remoteJid: chatId, fromMe: !!fromMe, id: messageId }, reaction })
          });
          const data = await r.json();
          if (!r.ok) return res.json({ success: false, error: data.message || JSON.stringify(data) });
          return res.json({ success: true });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }
      }

      case 'send': {
        const { chatId, message, userId, contactId } = req.body;
        if (!chatId || !message) {
          return res.status(400).json({ success: false, error: 'chatId and message are required' });
        }

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        let messageId: string | undefined;
        let rawData: any = {};

        const evolutionUrl = new URL(`/message/sendText/${instanceName}`, EVOLUTION_API_URL).toString();
        try {
          const r = await fetch(evolutionUrl, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number: chatId, text: message })
          });
          rawData = await r.json();

          if (!r.ok) {
            const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
            console.error('Send failed:', errMsg);
            return res.json({ success: false, error: errMsg });
          }

          messageId = rawData.key?.id || rawData.data?.key?.id || rawData.id || 'unknown';
        } catch (err: any) {
          console.error('Send error:', err.message);
          return res.json({ success: false, error: err.message });
        }

        // Persist outgoing message
        if (supabase) {
          try {
            await supabase.from('whatsapp_messages').insert({
              provider: 'evolution',
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: message,
              contact_id: contactId || null,
              raw: rawData,
              created_at: new Date().toISOString()
            });

            // Log to unified interactions timeline so contact history is complete
            if (contactId) {
              await supabase.from('interactions').insert({
                contact_id: contactId,
                user_id: userId || null,
                type: 'WHATSAPP',
                direction: 'OUTBOUND',
                content: message,
                metadata: { chat_id: chatId, message_id: messageId, provider: 'evolution' },
                timestamp: new Date().toISOString()
              });
            }
          } catch (err: any) {
            console.error('Message persistence error:', err.message);
          }
        }

        return res.json({ success: true, messageId });
      }

      case 'sendAudio': {
        // Send audio files via Evolution API
        const { chatId, audioBase64, mimeType } = req.body;
        if (!chatId || !audioBase64) {
          return res.status(400).json({ error: 'chatId, audioBase64 required' });
        }

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        const audioUrl = new URL(`/message/sendWhatsAppAudio/${instanceName}`, EVOLUTION_API_URL).toString();
        try {
          const r = await fetch(audioUrl, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              number: chatId,
              audio: `data:${mimeType || 'audio/mpeg'};base64,${audioBase64}`
            })
          });

          const rawData = await r.json();
          const messageId = rawData.key?.id || rawData.id || 'unknown';

          if (!r.ok) {
            const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
            return res.json({ success: false, error: errMsg });
          }

          // Persist audio message
          if (supabase) {
            await supabase.from('whatsapp_messages').insert({
              provider: 'evolution',
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: '[Audio Message]',
              message_type: 'audioMessage',
              raw: rawData,
              created_at: new Date().toISOString()
            });
          }

          return res.json({ success: true, messageId });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }
      }

      case 'sendFile': {
        req.body.mediaBase64 = req.body.fileBase64;
        req.body.mediaType = req.body.mimeType || 'application/octet-stream';
      }
        // falls through to sendMedia
      case 'sendMedia': {
        // Send images, videos, or documents via Evolution API
        const { chatId, mediaBase64, mediaType, fileName, caption, mimeType } = req.body;
        if (!chatId || !mediaBase64 || !mediaType || !fileName) {
          return res.status(400).json({ error: 'chatId, mediaBase64, mediaType, fileName required' });
        }

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        let messageId = 'unknown';
        let rawData: any = {};

        // Determine Evolution mediatype (must be lowercase)
        let evolutionMediaType = 'document';
        if (mediaType.toLowerCase().includes('image')) evolutionMediaType = 'image';
        else if (mediaType.toLowerCase().includes('video')) evolutionMediaType = 'video';
        else if (mediaType.toLowerCase().includes('audio')) evolutionMediaType = 'audio';

        const evolutionUrl = new URL(`/message/sendMedia/${instanceName}`, EVOLUTION_API_URL).toString();
        try {
          const r = await fetch(evolutionUrl, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              number: chatId,
              mediatype: evolutionMediaType,
              mimetype: mimeType || mediaType || 'application/octet-stream',
              caption: caption || '',
              media: mediaBase64,
              fileName
            })
          });

          rawData = await r.json();

          if (!r.ok) {
            const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
            return res.json({ success: false, error: errMsg });
          }

          messageId = rawData.key?.id || rawData.id || 'unknown';
        } catch (err: any) {
          console.error('SendMedia error:', err.message);
          return res.json({ success: false, error: err.message });
        }

        // Persist media message to database
        try {
          if (supabase) {
            const messageType = mediaType.includes('image') ? 'imageMessage' : mediaType.includes('video') ? 'videoMessage' : 'documentMessage';
            await supabase.from('whatsapp_messages').insert({
              provider: activeProvider,
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: caption || `[${mediaType}: ${fileName}]`,
              type: messageType,
              raw: rawData,
              created_at: new Date().toISOString()
            });
            console.log('[SendMedia Persistence] Message saved successfully');
          }
        } catch (err: any) {
          console.error('[SendMedia Persistence] Error:', err.message);
        }

        return res.json({ success: true, messageId, provider: activeProvider });
      }

      case 'searchMessages': {
        const q = req.query.q as string;
        if (!q || q.length < 2) return res.json({ success: true, results: [] });
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });
        const { data: msgs } = await supabase
          .from('whatsapp_messages').select('*')
          .ilike('body', `%${q}%`)
          .order('created_at', { ascending: false }).limit(50);
        return res.json({ success: true, results: msgs || [] });
      }

      case 'readChat': {
        // POST /api/whatsapp?action=readChat
        // Marks all messages in a chat as read in Evolution API
        const { chatId: readChatId } = req.body;
        if (!readChatId) return res.status(400).json({ success: false, error: 'chatId required' });
        try {
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (instanceName && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            await fetch(new URL(`/chat/markMessageAsRead/${instanceName}`, EVOLUTION_API_URL).toString(), {
              method: 'POST',
              headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ readMessages: [{ remoteJid: readChatId }] })
            });
          }
          return res.json({ success: true });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }
      }

      case 'bulkUpdateChats': {
        // POST /api/whatsapp?action=bulkUpdateChats
        // Bulk update multiple chats (status, assignedTo)
        const { chatIds, status, assignedTo } = req.body;

        if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
          return res.status(400).json({ success: false, error: 'chatIds array required' });
        }

        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
        }

        try {
          const updates: any = {};
          if (status) updates.status = status;
          if (assignedTo) updates.assigned_to = assignedTo;
          updates.updated_at = new Date().toISOString();

          if (Object.keys(updates).length === 0) {
            return res.json({ success: false, error: 'No updates specified' });
          }

          // Batch update in groups of 50
          let updated = 0;
          for (let i = 0; i < chatIds.length; i += 50) {
            const batch = chatIds.slice(i, i + 50);
            const { error } = await supabase
              .from('whatsapp_chats')
              .upsert(
                batch.map((id: string) => ({ chat_id: id, ...updates })),
                { onConflict: 'chat_id' }
              );

            if (error) {
              console.error('[bulkUpdateChats] Batch update error:', error);
            } else {
              updated += batch.length;
            }
          }

          return res.json({
            success: true,
            message: `Updated ${updated} chats`,
            updated
          });
        } catch (err: any) {
          console.error('[bulkUpdateChats] Error:', err?.message || err);
          return res.json({ success: false, error: err?.message || 'Bulk update failed' });
        }
      }

      case 'getCalls': {
        // GET /api/whatsapp?action=getCalls&chatId={id}&limit=20
        const chatId = req.query.chatId as string;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

        if (!chatId) return res.json({ success: true, calls: [] });
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });

        try {
          const { data: calls, error } = await supabase
            .from('whatsapp_calls')
            .select('*')
            .eq('chat_id', chatId)
            .order('started_at', { ascending: false })
            .limit(limit);

          if (error) {
            console.error('[getCalls] Database error:', error);
            return res.json({ success: false, error: error.message });
          }

          return res.json({
            success: true,
            calls: (calls || []).map((call: any) => ({
              id: call.id,
              type: 'call',
              callType: call.call_type,
              status: call.status, // 'answered', 'missed', 'rejected'
              duration: call.duration_seconds,
              timestamp: call.started_at,
              endedAt: call.ended_at
            }))
          });
        } catch (err: any) {
          console.error('[getCalls] Error:', err?.message || err);
          return res.json({ success: false, error: err?.message || 'Failed to fetch calls' });
        }
      }

      case 'getAllCalls': {
        // GET /api/whatsapp?action=getAllCalls&limit=100
        // Fetch all calls across all chats, sorted by date (missed first)
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
        const offset = parseInt(req.query.offset as string) || 0;

        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
        }

        try {
          const { data: calls, error } = await supabase
            .from('whatsapp_calls')
            .select('*')
            .order('started_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (error) {
            console.error('[getAllCalls] Database error:', error);
            return res.json({ success: false, error: error.message });
          }

          // Get chat metadata and contact details for each call
          const chatIds = [...new Set((calls || []).map((c: any) => c.chat_id))];
          const { data: chatMeta } = await supabase
            .from('whatsapp_chats')
            .select('chat_id, contact_name, assigned_to, assigned_to_user_id')
            .in('chat_id', chatIds);

          const contactMap: Record<string, any> = {};
          (chatMeta || []).forEach((row: any) => {
            contactMap[row.chat_id] = {
              name: row.contact_name || '',
              assignedTo: row.assigned_to || 'Unassigned',
              assignedToUserId: row.assigned_to_user_id || null
            };
          });

          // Also get contact records (by phone) for company/tags
          const phones = chatIds.map((id: string) => id.replace(/@[a-z.]+$/, ''));
          const { data: contacts } = await supabase
            .from('contacts')
            .select('phone_normalized, company, tags, status')
            .in('phone_normalized', phones);

          const contactDetailsMap: Record<string, any> = {};
          (contacts || []).forEach((c: any) => {
            contactDetailsMap[c.phone_normalized] = {
              company: c.company || null,
              tags: c.tags || [],
              status: c.status || null
            };
          });

          // Sort: missed calls first, then by timestamp
          const sorted = (calls || []).sort((a: any, b: any) => {
            const aMissed = a.status === 'missed' ? 0 : 1;
            const bMissed = b.status === 'missed' ? 0 : 1;
            if (aMissed !== bMissed) return aMissed - bMissed;
            return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
          });

          return res.json({
            success: true,
            calls: sorted.map((call: any) => {
              const phone = call.chat_id.replace(/@[a-z.]+$/, '');
              const chatData = contactMap[call.chat_id] || {};
              const contactDetails = contactDetailsMap[phone] || {};
              return {
                id: call.id,
                chatId: call.chat_id,
                contactName: chatData.name || call.chat_id,
                assignedTo: chatData.assignedTo || 'Unassigned',
                assignedToUserId: chatData.assignedToUserId || null,
                company: contactDetails.company || null,
                tags: contactDetails.tags || [],
                callType: call.call_type,
                status: call.status,
                duration: call.duration_seconds,
                timestamp: call.started_at
              };
            })
          });
        } catch (err: any) {
          console.error('[getAllCalls] Error:', err?.message || err);
          return res.json({ success: false, error: err?.message || 'Failed to fetch calls' });
        }
      }

      case 'searchUnified': {
        // Unified search: finds contacts, chats, and messages in one query
        const q = req.query.q as string;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const offset = parseInt(req.query.offset as string) || 0;

        if (!q || q.length < 2) return res.json({ success: true, results: [], total: 0 });
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });

        try {
          const searchPattern = `%${q}%`;

          // 1. Search messages by text content
          const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .ilike('body', searchPattern)
            .order('created_at', { ascending: false })
            .limit(20);

          // 2. Search chats by contact name or phone — search sender_name in messages
          // (whatsapp_chats only has metadata for chats that have been manually updated)
          const { data: chatMsgRows } = await supabase
            .from('whatsapp_messages')
            .select('chat_id, sender_name, created_at, direction, body')
            .ilike('sender_name', searchPattern)
            .order('created_at', { ascending: false })
            .limit(50);

          // Deduplicate to one result per chat_id (keep newest)
          const seenChatMap: Record<string, any> = {};
          (chatMsgRows || []).forEach((m: any) => {
            if (!seenChatMap[m.chat_id]) seenChatMap[m.chat_id] = m;
          });

          // Also search whatsapp_chats (for chats with manually set contact_name)
          const { data: chatMetaRows } = await supabase
            .from('whatsapp_chats')
            .select('*')
            .or(`contact_name.ilike.${searchPattern},chat_id.ilike.${searchPattern}`)
            .limit(10);

          // Merge: chatMetaRows overrides message-based results for same chat_id
          const chatMetaMap: Record<string, any> = {};
          (chatMetaRows || []).forEach((r: any) => { chatMetaMap[r.chat_id] = r; });

          // Combined unique chats from both sources
          const allChatIds = new Set([
            ...Object.keys(seenChatMap),
            ...Object.keys(chatMetaMap)
          ]);
          const chats = Array.from(allChatIds).slice(0, 10).map(chatId => {
            const meta = chatMetaMap[chatId];
            const msg = seenChatMap[chatId];
            return {
              chat_id: chatId,
              contact_name: meta?.contact_name || msg?.sender_name || null,
              status: meta?.status || 'active',
              assigned_to: meta?.assigned_to || 'Unassigned',
              assigned_to_user_id: meta?.assigned_to_user_id || null,
              last_message: msg?.body?.substring(0, 60) || '',
              last_message_at: msg?.created_at || null,
              last_message_from_me: msg?.direction === 'outbound'
            };
          });

          // 3. Search contacts by name, company, or phone (linked to WhatsApp)
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('source', 'WHATSAPP')
            .or(`name.ilike.${searchPattern},company.ilike.${searchPattern},phone_normalized.ilike.${q.replace(/[^\d]/g, '')}`)
            .limit(10);

          // Combine and deduplicate by type
          const results = [];
          const seenChatIds = new Set<string>();

          // Add chat results first (highest priority)
          if (chats) {
            for (const chat of chats) {
              results.push({
                type: 'chat',
                id: chat.chat_id,
                name: chat.contact_name || chat.chat_id,
                status: chat.status || 'active',
                assignedTo: chat.assigned_to || 'Unassigned',
                assignedToUserId: chat.assigned_to_user_id || null,
                phone: chat.chat_id.replace(/@[a-z.]+$/, ''),
                lastMessage: chat.last_message || '',
                lastMessageAt: chat.last_message_at || null,
                lastMessageFromMe: chat.last_message_from_me || false
              });
              seenChatIds.add(chat.chat_id);
            }
          }

          // Add message results (with chat context)
          if (messages) {
            const addedMessages = new Set<string>();
            for (const msg of messages) {
              if (!addedMessages.has(msg.id)) {
                // Find chat metadata if available
                const chatMeta = chats?.find((c: any) => c.chat_id === msg.chat_id);
                results.push({
                  type: 'message',
                  id: msg.id,
                  chatId: msg.chat_id,
                  chatName: chatMeta?.contact_name || msg.chat_id.replace(/@[a-z.]+$/, ''),
                  text: msg.body?.substring(0, 100) + (msg.body?.length > 100 ? '...' : ''),
                  timestamp: msg.created_at,
                  direction: msg.direction,
                  messageId: msg.provider_message_id
                });
                addedMessages.add(msg.id);
              }
            }
          }

          // Add contact results
          if (contacts) {
            for (const contact of contacts) {
              results.push({
                type: 'contact',
                id: contact.id,
                name: contact.name,
                company: contact.company,
                phone: contact.phone,
                status: contact.status
              });
            }
          }

          return res.json({
            success: true,
            results: results.slice(offset, offset + limit),
            total: results.length
          });
        } catch (err: any) {
          console.error('[searchUnified] Error:', err?.message || err);
          return res.json({ success: false, error: err?.message || 'Search failed' });
        }
      }

      // ========== EVOLUTION API ACTIONS ==========

      case 'createInstance': {
        // POST /api/whatsapp?action=createInstance
        // Creates a new Evolution API instance and returns QR code
        if (!EVOLUTION_API_URL) {
          return res.status(400).json({
            success: false,
            error: 'Evolution API not configured',
            message: 'Please set EVOLUTION_API_URL environment variable'
          });
        }

        try {
          // Generate unique instance name: dhd-crm-{timestamp}-{random}
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substring(2, 8);
          const instanceName = `dhd-crm-${timestamp}-${random}`;

          // Call Evolution API to create instance
          // Evolution API v2 uses /instance/create (not /api/instances/create)
          const createUrl = new URL('/instance/create', EVOLUTION_API_URL).toString();
          const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(EVOLUTION_API_KEY && { 'apikey': EVOLUTION_API_KEY })
            },
            body: JSON.stringify({
              instanceName,
              integration: 'WHATSAPP-BAILEYS'
            })
          });

          const createData = await createRes.json();

          if (!createRes.ok || !createData.instance) {
            console.error('[whatsapp] Evolution createInstance failed:', createData);
            return res.status(400).json({
              success: false,
              error: createData.error || 'Failed to create Evolution instance',
              details: createData
            });
          }

          // Get QR code for the new instance using /instance/connect/{name}
          try {
            const connectUrl = new URL(`/instance/connect/${instanceName}`, EVOLUTION_API_URL).toString();
            const connectRes = await fetch(connectUrl, {
              method: 'GET',
              headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}
            });

            const connectData = await connectRes.json();

            if (!connectRes.ok) {
              console.error('[whatsapp] Evolution getQRCode failed:', connectData);
              return res.status(400).json({
                success: false,
                error: connectData.error || 'Failed to get QR code'
              });
            }

            return res.json({
              success: true,
              instanceName,
              qrCode: connectData.base64, // base64 field contains the QR code image
              code: connectData.code,
              count: connectData.count,
              message: 'Instance created. Scan QR code to authenticate.'
            });
          } catch (err: any) {
            console.error('[whatsapp] createInstance QR code fetch error:', err);
            return res.status(500).json({
              success: false,
              error: 'Failed to get QR code',
              message: err.message
            });
          }
        } catch (err: any) {
          console.error('[whatsapp] createInstance error:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to create Evolution instance',
            message: err.message
          });
        }
      }

      case 'getQRCode': {
        // GET /api/whatsapp?action=getQRCode&instanceName=...
        // Gets QR code for an existing instance
        const instanceName = req.query.instanceName as string;
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'instanceName query parameter required' });
        }

        if (!EVOLUTION_API_URL) {
          return res.status(400).json({
            success: false,
            error: 'Evolution API not configured'
          });
        }

        try {
          // Evolution API v2 correct QR code endpoint: /instance/connect/{name}
          const connectUrl = new URL(`/instance/connect/${instanceName}`, EVOLUTION_API_URL).toString();
          const connectRes = await fetch(connectUrl, {
            method: 'GET',
            headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}
          });

          const connectData = await connectRes.json();

          if (!connectRes.ok) {
            console.error('[whatsapp] Evolution getQRCode failed:', connectData);
            return res.status(400).json({
              success: false,
              error: connectData.error || 'Failed to get QR code'
            });
          }

          return res.json({
            success: true,
            qrCode: connectData.base64,
            code: connectData.code,
            count: connectData.count
          });
        } catch (err: any) {
          console.error('[whatsapp] getQRCode error:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to get QR code',
            message: err.message
          });
        }
      }

      case 'getInstanceStatus': {
        // GET /api/whatsapp?action=getInstanceStatus&instanceName=...
        // Checks if instance is authenticated
        const instanceName = req.query.instanceName as string;
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'instanceName query parameter required' });
        }

        if (!EVOLUTION_API_URL) {
          return res.status(400).json({
            success: false,
            error: 'Evolution API not configured'
          });
        }

        try {
          // Try the /instance/{name}/connectionState endpoint first
          let statusData: any = null;
          let authenticated = false;
          let phone = null;

          // Attempt 1: /instance/{name}/connectionState
          try {
            const stateUrl = new URL(`/instance/${instanceName}/connectionState`, EVOLUTION_API_URL).toString();
            const stateRes = await fetch(stateUrl, {
              method: 'GET',
              headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}
            });
            if (stateRes.ok) {
              statusData = await stateRes.json();
              authenticated = statusData.instance?.state === 'open' || statusData.instance?.authenticated === true;
              phone = statusData.instance?.phone || statusData.phone;
            }
          } catch (e) {
            console.warn('[whatsapp] connectionState endpoint failed, trying /instance/connect');
          }

          // Fallback: Use /instance/connect to infer connection state
          if (!statusData) {
            const connectUrl = new URL(`/instance/connect/${instanceName}`, EVOLUTION_API_URL).toString();
            const connectRes = await fetch(connectUrl, {
              method: 'GET',
              headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}
            });

            if (connectRes.ok) {
              const connectData = await connectRes.json();
              statusData = connectData;
              // If /instance/connect returns data, instance exists but may not be authenticated
              // (authenticated status comes from the manager or through webhooks)
              authenticated = connectData.count > 0 && !connectData.code;
            } else {
              return res.status(400).json({
                success: false,
                error: 'Instance not found or not ready'
              });
            }
          }

          // If authenticated, save instance name to Supabase settings
          // Note: phone may not be available immediately, but if state is 'open' it's authenticated
          if (authenticated) {
            await setSetting('EVOLUTION_INSTANCE_NAME', instanceName);
            if (phone) {
              await setSetting('EVOLUTION_PHONE', phone);
            }
          }

          return res.json({
            success: true,
            authenticated,
            phone,
            instanceName,
            raw: statusData
          });
        } catch (err: any) {
          console.error('[whatsapp] getInstanceStatus error:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to get instance status',
            message: err.message
          });
        }
      }

      case 'webhookConfig': {
        // Returns webhook configuration info for Evolution API
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        const isConfigured = !!instanceName;

        return res.json({
          success: true,
          configured: isConfigured,
          instanceName,
          webhookUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/whatsapp`,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
          messageFormat: 'Baileys (Evolution API)'
        });
      }

      case 'initiateCall': {
        // POST /api/whatsapp?action=initiateCall
        // Initiate a WhatsApp call via Evolution API
        const { chatId, isVideo } = req.body;

        if (!chatId) {
          return res.status(400).json({ success: false, error: 'chatId required' });
        }

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        try {
          const callUrl = new URL(`/message/sendCall/${instanceName}`, EVOLUTION_API_URL).toString();
          const r = await fetch(callUrl, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              number: chatId,
              isVideo: isVideo || false
            })
          });

          const data = await r.json();

          if (!r.ok) {
            const errMsg = data.message || data.error || JSON.stringify(data);
            console.error('Call initiation failed:', errMsg);
            return res.json({ success: false, error: errMsg });
          }

          return res.json({
            success: true,
            callId: data.id || data.callId || 'unknown',
            message: 'Call initiated'
          });
        } catch (err: any) {
          console.error('Call initiation error:', err.message);
          return res.json({ success: false, error: err.message });
        }
      }

      case 'disconnect': {
        // POST /api/whatsapp?action=disconnect
        // Disconnects WhatsApp (deletes Evolution instance)
        if (!EVOLUTION_API_URL) {
          return res.status(400).json({
            success: false,
            error: 'Evolution API not configured'
          });
        }

        try {
          // Read instance name from settings
          const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');

          if (!instanceName) {
            return res.status(400).json({
              success: false,
              error: 'No Evolution instance currently connected'
            });
          }

          // Call Evolution API to delete instance
          // Evolution API v2: DELETE /instance/{name}
          const deleteUrl = new URL(`/instance/${instanceName}`, EVOLUTION_API_URL).toString();
          const deleteRes = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: EVOLUTION_API_KEY ? { 'apikey': EVOLUTION_API_KEY } : {}
          });

          const deleteData = await deleteRes.json();

          // Handle 404 gracefully - instance already gone, clear settings anyway
          if (!deleteRes.ok && deleteRes.status !== 404) {
            console.error('[whatsapp] Evolution disconnect failed:', deleteData);
            return res.status(400).json({
              success: false,
              error: deleteData.error || 'Failed to disconnect instance'
            });
          }

          // Log what happened
          if (deleteRes.status === 404) {
            console.warn('[whatsapp] Instance not found in Evolution API (already deleted), clearing settings');
          } else {
            console.log('[whatsapp] Instance deleted from Evolution API');
          }

          // Clear settings
          await setSetting('EVOLUTION_INSTANCE_NAME', '');
          await setSetting('EVOLUTION_PHONE', '');

          return res.json({
            success: true,
            message: 'WhatsApp disconnected successfully'
          });
        } catch (err: any) {
          console.error('[whatsapp] disconnect error:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to disconnect',
            message: err.message
          });
        }
      }

      case 'debugSaveInstance': {
        // Temporary debug endpoint - saves instance name and phone (for emergencies)
        const { instanceName, phone } = req.body;
        if (!instanceName) {
          return res.status(400).json({ error: 'instanceName required' });
        }

        if (!supabase) {
          return res.status(500).json({ success: false, error: 'Supabase not configured' });
        }

        try {
          // Save instance name
          const { error: error1 } = await supabase
            .from('app_settings')
            .upsert({ setting_key: 'EVOLUTION_INSTANCE_NAME', setting_value: instanceName }, { onConflict: 'setting_key' });

          if (error1) {
            console.error('[debugSaveInstance] Instance save error:', error1);
            return res.status(500).json({ success: false, error: error1.message });
          }

          // Save phone if provided
          if (phone) {
            const { error: error2 } = await supabase
              .from('app_settings')
              .upsert({ setting_key: 'EVOLUTION_PHONE', setting_value: phone }, { onConflict: 'setting_key' });

            if (error2) {
              console.error('[debugSaveInstance] Phone save error:', error2);
            }
          }

          // Update cache
          _settingCache['EVOLUTION_INSTANCE_NAME'] = { value: instanceName, ts: Date.now() };
          if (phone) {
            _settingCache['EVOLUTION_PHONE'] = { value: phone, ts: Date.now() };
          }

          return res.json({ success: true, message: 'Instance and phone saved', instanceName, phone: phone || 'not provided' });
        } catch (err: any) {
          console.error('[debugSaveInstance] Error:', err.message);
          return res.status(500).json({ success: false, error: err.message });
        }
      }

      case 'syncEvolutionMessages': {
        // Sync historical messages from Evolution API chat (single or all)
        // API response format: { messages: { total, pages, currentPage, records: [...] } }
        // Each record: { key: { id, fromMe, remoteJid }, pushName, message: { conversation }, messageType, messageTimestamp }
        const { chatId, limit: syncLimit, offset: syncOffset } = req.body;
        const maxChats = Math.min(parseInt(syncLimit) || 50, 100); // max 100 chats per call
        const chatOffset = parseInt(syncOffset) || 0;

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        // Helper: extract messages from Evolution API response (handles both old array and new nested format)
        function extractRecords(data: any): any[] {
          if (Array.isArray(data)) return data;
          if (data?.messages?.records) return data.messages.records;
          if (data?.records) return data.records;
          return [];
        }

        // Helper: map a message record to DB row
        function mapToDbRow(msg: any, jid: string, chatName: string): any {
          const msgText = msg.message?.conversation ||
                          msg.message?.extendedTextMessage?.text ||
                          msg.message?.imageMessage?.caption ||
                          msg.message?.videoMessage?.caption ||
                          msg.message?.documentMessage?.caption ||
                          '';
          // Extract media URL (Evolution API uses 'url' field on media sub-objects)
          const m = msg.message || {};
          const mediaSrc =
            m.imageMessage?.url || m.imageMessage?.downloadUrl ||
            m.videoMessage?.url || m.videoMessage?.downloadUrl ||
            m.audioMessage?.url || m.audioMessage?.downloadUrl ||
            m.pttMessage?.url || m.pttMessage?.downloadUrl ||
            m.documentMessage?.url || m.documentMessage?.downloadUrl ||
            m.stickerMessage?.url || m.stickerMessage?.downloadUrl ||
            null;
          return {
            provider: 'evolution',
            provider_message_id: msg.key?.id,
            chat_id: msg.key?.remoteJid || jid,
            sender_name: msg.pushName || chatName || '',
            direction: msg.key?.fromMe ? 'outbound' : 'inbound',
            body: msgText || (msg.messageType ? `[${msg.messageType}]` : ''),
            message_type: msg.messageType || 'conversation',
            media_url: mediaSrc,
            raw: msg,
            created_at: msg.messageTimestamp
              ? new Date(msg.messageTimestamp > 1e10 ? msg.messageTimestamp : msg.messageTimestamp * 1000).toISOString()
              : new Date().toISOString()
          };
        }

        try {
          // If chatId specified, sync single chat
          if (chatId) {
            console.log('[syncEvolutionMessages] Syncing single chat:', chatId);
            const messagesUrl = new URL(`/chat/findMessages/${instanceName}`, EVOLUTION_API_URL).toString();
            const r = await fetch(messagesUrl, {
              method: 'POST',
              headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ where: { key: { remoteJid: chatId } }, limit: 200 })
            });

            if (!r.ok) {
              console.error('[syncEvolutionMessages] API error:', r.status);
              return res.json({ success: false, error: 'Failed to fetch messages' });
            }

            const rawData = await r.json();
            const records = extractRecords(rawData);
            console.log('[syncEvolutionMessages] Found', records.length, 'messages for chat', chatId);

            if (supabase && records.length > 0) {
              const toInsert = records.filter((m: any) => m.key?.id).map((m: any) => mapToDbRow(m, chatId, ''));
              const { error } = await supabase.from('whatsapp_messages')
                .upsert(toInsert, { onConflict: 'provider_message_id', ignoreDuplicates: true });
              if (error) {
                console.error('[syncEvolutionMessages] DB error:', error);
                return res.json({ success: false, error: 'Failed to save messages', dbError: error.message });
              }
              return res.json({ success: true, message: 'Single chat synced', count: toInsert.length, fromApi: records.length });
            }
            return res.json({ success: true, message: 'No messages found in Evolution API', count: 0, fromApi: 0 });
          }

          // Sync batch of recent chats (sorted by updatedAt descending)
          console.log('[syncEvolutionMessages] Syncing recent chats, offset:', chatOffset, 'limit:', maxChats);
          const chatsUrl = new URL(`/chat/findChats/${instanceName}`, EVOLUTION_API_URL).toString();
          const chatsRes = await fetch(chatsUrl, {
            method: 'POST',
            headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(15000)
          });

          if (!chatsRes.ok) {
            const errBody = await chatsRes.text().catch(() => '');
            console.error('[syncEvolutionMessages] findChats failed:', chatsRes.status, errBody);

            // Fallback: pull recent messages directly without chat list
            // Groups them by chatId to build a synthetic chat list
            console.log('[syncEvolutionMessages] Falling back to direct message fetch...');
            const msgsUrl = new URL(`/chat/findMessages/${instanceName}`, EVOLUTION_API_URL).toString();
            const msgsRes = await fetch(msgsUrl, {
              method: 'POST',
              headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ where: {}, limit: 200 }),
              signal: AbortSignal.timeout(15000)
            });

            if (!msgsRes.ok) {
              const msgsErr = await msgsRes.text().catch(() => '');
              console.error('[syncEvolutionMessages] Fallback also failed:', msgsRes.status, msgsErr);
              return res.json({ success: false, error: `Evolution API error ${chatsRes.status}: ${errBody.slice(0, 200)}` });
            }

            const msgsData = await msgsRes.json();
            const allRecords = extractRecords(msgsData);
            console.log('[syncEvolutionMessages] Fallback got', allRecords.length, 'messages');

            if (supabase && allRecords.length > 0) {
              const toInsert = allRecords.filter((m: any) => m.key?.id).map((m: any) => mapToDbRow(m, m.key?.remoteJid || '', m.pushName || ''));
              const { error: dbErr } = await supabase.from('whatsapp_messages')
                .upsert(toInsert, { onConflict: 'provider_message_id', ignoreDuplicates: true });
              if (dbErr) return res.json({ success: false, error: dbErr.message });
              return res.json({ success: true, count: toInsert.length, chatsProcessed: new Set(toInsert.map((m: any) => m.chat_id)).size, message: 'Synced via fallback (direct messages)' });
            }
            return res.json({ success: true, count: 0, message: 'No messages found via fallback' });
          }

          const allChats = await chatsRes.json();
          const chatList = Array.isArray(allChats) ? allChats : [];
          console.log('[syncEvolutionMessages] Total chats available:', chatList.length);

          // Sort by updatedAt descending (most recent first), then paginate
          chatList.sort((a: any, b: any) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          );

          const chatBatch = chatList.slice(chatOffset, chatOffset + maxChats);
          if (chatBatch.length === 0) {
            return res.json({ success: true, message: 'No more chats to sync', count: 0, totalChats: chatList.length });
          }

          // Sync messages for each chat in batch
          let totalSynced = 0;
          let chatsWithMessages = 0;
          for (const chat of chatBatch) {
            const chatRemoteJid = chat.remoteJid || chat.id;
            if (!chatRemoteJid) continue;

            try {
              const messagesUrl = new URL(`/chat/findMessages/${instanceName}`, EVOLUTION_API_URL).toString();
              const r = await fetch(messagesUrl, {
                method: 'POST',
                headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ where: { key: { remoteJid: chatRemoteJid } }, limit: 50 })
              });

              if (!r.ok) continue;

              const rawData = await r.json();
              const records = extractRecords(rawData);
              if (records.length === 0) continue;

              const chatName = chat.pushName || chat.name || '';
              const toInsert = records.filter((m: any) => m.key?.id).map((m: any) => mapToDbRow(m, chatRemoteJid, chatName));

              if (supabase && toInsert.length > 0) {
                const { error } = await supabase.from('whatsapp_messages')
                  .upsert(toInsert, { onConflict: 'provider_message_id', ignoreDuplicates: true });
                if (!error) {
                  totalSynced += toInsert.length;
                  chatsWithMessages++;
                } else {
                  console.error('[syncEvolutionMessages] DB error for', chatRemoteJid, ':', error.message);
                }
              }
            } catch (err) {
              console.error('[syncEvolutionMessages] Error syncing chat', chatRemoteJid, ':', err);
            }
          }

          const hasMore = (chatOffset + maxChats) < chatList.length;
          return res.json({
            success: true,
            message: `Synced ${totalSynced} messages from ${chatsWithMessages} chats`,
            count: totalSynced,
            chatsProcessed: chatBatch.length,
            chatsWithMessages,
            totalChats: chatList.length,
            nextOffset: hasMore ? chatOffset + maxChats : null,
            hasMore
          });

        } catch (err: any) {
          console.error('[syncEvolutionMessages] Error:', err.message);
          return res.json({ success: false, error: err.message });
        }
      }

      // ── Chat status persistence ──────────────────────────────────────────
      case 'updateChatStatus': {
        // Save/update a chat's status (active | resolved | pending) in DB
        const { chatId, status, assignedTo, assignedToUserId } = req.body;
        if (!supabase || !chatId || !status) {
          return res.status(400).json({ success: false, error: 'Missing chatId or status' });
        }
        const upsertData: any = {
          chat_id: chatId,
          status,
          assigned_to: assignedTo || 'Unassigned',
          updated_at: new Date().toISOString()
        };
        if (assignedToUserId !== undefined) {
          upsertData.assigned_to_user_id = assignedToUserId || null;
        }
        const { error } = await supabase.from('whatsapp_chats').upsert(upsertData, { onConflict: 'chat_id' });
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, chatId, status });
      }

      case 'getChatStatuses': {
        // Return all persisted chat statuses so the UI can restore state after refresh
        if (!supabase) return res.json({ success: true, statuses: {} });
        const { data, error: _error } = await supabase
          .from('whatsapp_chats')
          .select('chat_id, status, assigned_to, assigned_to_user_id, contact_name');
        if (_error) return res.status(500).json({ success: false, error: _error.message });
        const statuses: Record<string, any> = {};
        (data || []).forEach((row: any) => {
          statuses[row.chat_id] = {
            status: row.status,
            assignedTo: row.assigned_to,
            assignedToUserId: row.assigned_to_user_id,
            contactName: row.contact_name
          };
        });
        return res.json({ success: true, statuses });
      }

      // ── Contact name resolution for @lid JIDs ────────────────────────────
      case 'syncContactNames': {
        // Fetch contacts from Evolution API and store name+phone mappings
        // so @lid JIDs can be resolved to real names in the chat list
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }
        try {
          const r = await fetch(
            new URL(`/chat/findContacts/${instanceName}`, EVOLUTION_API_URL).toString(),
            { method: 'POST', headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ where: {} }) }
          );
          if (!r.ok) return res.json({ success: false, error: `Evolution API returned ${r.status}` });

          const contacts = await r.json();
          const list = Array.isArray(contacts) ? contacts : (contacts?.contacts || contacts?.data || []);

          // Build a name map: remoteJid → pushName (or formatted phone)
          const nameMap: Record<string, string> = {};
          list.forEach((c: any) => {
            const jid = c.remoteJid || c.id || '';
            const name = c.pushName || c.fullName || c.name || '';
            if (jid && name) nameMap[jid] = name;
          });

          // Persist to whatsapp_chats so chatsFromDb can look it up
          if (supabase && Object.keys(nameMap).length > 0) {
            const rows = Object.entries(nameMap).map(([chatId, contactName]) => ({
              chat_id: chatId, contact_name: contactName, updated_at: new Date().toISOString()
            }));
            // Upsert in batches of 100
            for (let i = 0; i < rows.length; i += 100) {
              await supabase.from('whatsapp_chats').upsert(rows.slice(i, i + 100), { onConflict: 'chat_id' });
            }
          }
          return res.json({ success: true, count: Object.keys(nameMap).length });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }
      }

      case 'fullDiagnostics': {
        // Comprehensive diagnostic report
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
        const evolutionInstanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        const evolutionPhone = await getSetting('EVOLUTION_PHONE', '');

        // Count messages in database
        let totalMessages = 0;
        let evolutionMessages = 0;
        let inboundMessages = 0;
        let outboundMessages = 0;

        if (supabase) {
          try {
            const { count: total } = await supabase
              .from('whatsapp_messages')
              .select('*', { count: 'exact', head: true });

            const { count: evo } = await supabase
              .from('whatsapp_messages')
              .select('*', { count: 'exact', head: true })
              .eq('provider', 'evolution');

            const { count: inbound } = await supabase
              .from('whatsapp_messages')
              .select('*', { count: 'exact', head: true })
              .eq('direction', 'inbound');

            const { count: outbound } = await supabase
              .from('whatsapp_messages')
              .select('*', { count: 'exact', head: true })
              .eq('direction', 'outbound');

            totalMessages = total || 0;
            evolutionMessages = evo || 0;
            inboundMessages = inbound || 0;
            outboundMessages = outbound || 0;
          } catch (err) {
            console.error('[fullDiagnostics] DB query error:', err);
          }
        }

        // Check webhook
        let webhookConfigured = false;
        try {
          const webhookUrl = new URL(`/webhook/find/${evolutionInstanceName}`, EVOLUTION_API_URL).toString();
          const r = await fetch(webhookUrl, {
            headers: { 'apikey': EVOLUTION_API_KEY }
          });
          const data = await r.json();
          webhookConfigured = data?.url ? true : false;
        } catch (err) {
          console.error('[fullDiagnostics] Webhook check error:', err);
        }

        return res.json({
          success: true,
          diagnostics: {
            config: {
              activeProvider,
              evolutionInstanceName,
              evolutionPhone,
              evolutionConfigured: !!EVOLUTION_API_URL && !!EVOLUTION_API_KEY
            },
            database: {
              totalMessages,
              evolutionMessages,
              inboundMessages,
              outboundMessages,
              supabaseConnected: supabase !== null
            },
            webhook: {
              configured: webhookConfigured,
              url: webhookConfigured ? 'Configured ✅' : 'Not configured ❌',
              instanceName: evolutionInstanceName
            },
            api: {
              evolutionUrl: EVOLUTION_API_URL ? 'SET ✅' : 'NOT SET ❌',
              evolutionKey: EVOLUTION_API_KEY ? 'SET ✅' : 'NOT SET ❌'
            }
          }
        });
      }

      case 'diagnostics': {
        // Debug endpoint to check configuration
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
        const evolutionInstanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        const evolutionPhone = await getSetting('EVOLUTION_PHONE', '');

        return res.json({
          success: true,
          diagnostics: {
            activeProvider,
            evolution: {
              configured: !!EVOLUTION_API_URL && !!EVOLUTION_API_KEY,
              url: EVOLUTION_API_URL ? EVOLUTION_API_URL.substring(0, 30) + '...' : 'NOT SET',
              apiKey: EVOLUTION_API_KEY ? 'SET' : 'NOT SET',
              instanceName: evolutionInstanceName || 'NOT SET',
              phone: evolutionPhone || 'NOT SET'
            },
            supabase: {
              configured: supabase !== null,
              url: _supabaseUrl ? _supabaseUrl.substring(0, 30) + '...' : 'NOT SET'
            }
          }
        });
      }

      case 'addGSMCall': {
        // POST /api/whatsapp?action=addGSMCall
        // Receives batched call log from Android companion app
        // Body: { calls: [{phoneNumber, callType, duration_seconds, timestamp}], device: string, phone?: string }
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
        }

        const { calls: gsmCalls, device: deviceModel, phone: repPhone, app_version: appVersion } = req.body;

        if (!gsmCalls || !Array.isArray(gsmCalls)) {
          return res.status(400).json({ success: false, error: 'calls array required' });
        }

        try {
          let inserted = 0;
          let skipped = 0;

          // ── Auto-register / heartbeat device ────────────────────────────────
          let deviceUserId: string | null = null;
          let deviceRepName: string | null = null;
          if (repPhone) {
            await supabase.from('devices').upsert({
              phone_number:   repPhone,
              device_model:   deviceModel || null,
              is_active:      true,
              last_heartbeat: new Date().toISOString(),
              ...(appVersion ? { app_version: appVersion } : {}),
            }, { onConflict: 'phone_number' }).select();

            // Fetch the linked user_id and device_name so we can attribute calls
            const { data: deviceRow } = await supabase
              .from('devices')
              .select('user_id, device_name')
              .eq('phone_number', repPhone)
              .maybeSingle();
            if (deviceRow) {
              deviceUserId = deviceRow.user_id || null;
              deviceRepName = deviceRow.device_name || null;
            }

            // Mark the linked rep as having the companion app installed
            if (deviceUserId) {
              await supabase
                .from('user_profiles')
                .update({ companion_installed: true })
                .eq('id', deviceUserId);
            }
          }

          for (const call of gsmCalls) {
            const { phoneNumber, callType, duration_seconds, timestamp } = call;
            if (!phoneNumber || !callType || !timestamp) { skipped++; continue; }

            // Normalize phone — strip non-digits
            const phoneNorm = String(phoneNumber).replace(/[^\d]/g, '');
            const calledAt = new Date(Number(timestamp)).toISOString();

            // Look up existing contact by normalized phone
            let contactId: string | null = null;
            let contactName: string | null = null;
            if (phoneNorm) {
              const { data: contact } = await supabase
                .from('contacts')
                .select('id, name')
                .eq('phone_normalized', phoneNorm)
                .maybeSingle();
              if (contact) {
                contactId = contact.id;
                contactName = contact.name || null;
              }
            }

            // Upsert into cellular_calls (deduplicate on phone + timestamp)
            const { error: upsertErr } = await supabase
              .from('cellular_calls')
              .upsert({
                phone_number: String(phoneNumber),
                phone_normalized: phoneNorm || null,
                call_type: String(callType).toUpperCase(),
                duration_seconds: Number(duration_seconds) || 0,
                called_at: calledAt,
                contact_id: contactId,
                contact_name: contactName,
                device_model: deviceModel || null,
                rep_phone: repPhone || null,
                rep_id: deviceUserId || null,
                rep_name: deviceRepName || null,
              }, { onConflict: 'phone_normalized,called_at', ignoreDuplicates: true });

            if (!upsertErr) {
              inserted++;
              // Log interaction for the contact if matched
              if (contactId) {
                const direction = String(callType).toUpperCase() === 'OUTGOING' ? 'OUTBOUND' : 'INBOUND';
                try {
                  await supabase.from('interactions').insert({
                    contact_id: contactId,
                    type: 'CALL',
                    direction,
                    content: `GSM ${callType} call${duration_seconds ? ` (${duration_seconds}s)` : ''}`,
                    metadata: { source: 'gsm', device_model: deviceModel, phone_number: phoneNumber, duration_seconds, rep_phone: repPhone || null },
                    timestamp: calledAt
                  });
                } catch (interactionErr) {
                  // Log interaction insertion errors but don't fail the sync (non-blocking)
                  console.warn('[addGSMCall] interaction insert failed (non-blocking):', interactionErr);
                }
              }
            } else {
              if (upsertErr.code !== '23505') { // ignore unique violation
                console.error('[addGSMCall] upsert error:', upsertErr.message);
              }
              skipped++;
            }
          }

          // Include latest release version so the app learns about updates on every sync
          const release = await fetchLatestRelease().catch(() => ({ version: null, downloadUrl: '', publishedAt: null }));
          return res.json({ success: true, inserted, skipped, total: gsmCalls.length, latestVersion: release.version, updateAvailable: release.version && appVersion ? release.version !== appVersion : false, downloadUrl: release.downloadUrl });
        } catch (err: any) {
          console.error('[addGSMCall] Error:', err?.message || err);
          return res.json({ success: false, error: err?.message || 'Failed to store GSM calls' });
        }
      }

      case 'getDevices': {
        // GET /api/whatsapp?action=getDevices
        // Returns all registered companion devices with last heartbeat & rep name
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });
        try {
          const { data, error: _error } = await supabase
            .from('devices')
            .select('device_id, phone_number, device_name, device_model, is_active, last_heartbeat, created_at')
            .order('last_heartbeat', { ascending: false });
          if (_error) throw _error;
          return res.json({ success: true, devices: data || [] });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }
      }

      case 'getLatestRelease': {
        // GET /api/whatsapp?action=getLatestRelease
        // Returns latest GitHub release version for the companion app
        const release = await fetchLatestRelease();
        return res.json({ success: true, ...release });
      }

      case 'checkVersion': {
        // GET /api/whatsapp?action=checkVersion&current=1.2.3
        // Called by the Android app on startup to check if an update is available
        const currentVersion = req.query.current as string | undefined;
        const release = await fetchLatestRelease();
        let updateAvailable = false;
        if (currentVersion && release.version) {
          // Simple semver comparison: split by "." and compare numeric parts
          const cur = currentVersion.split('.').map(Number);
          const lat = release.version.split('.').map(Number);
          for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
            const c = cur[i] ?? 0;
            const l = lat[i] ?? 0;
            if (l > c) { updateAvailable = true; break; }
            if (c > l) break;
          }
        }
        return res.json({ success: true, updateAvailable, latestVersion: release.version, downloadUrl: release.downloadUrl, publishedAt: release.publishedAt });
      }

      case 'publishVersion': {
        // POST /api/whatsapp?action=publishVersion
        // Called by CI after a new release is published
        // Body: { version: "1.0.3", downloadUrl: "https://..." }
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });
        const { version: pubVersion, downloadUrl: pubUrl } = req.body;
        if (!pubVersion) return res.status(400).json({ success: false, error: 'version required' });
        try {
          await supabase.from('app_settings').upsert([
            { setting_key: 'COMPANION_APP_VERSION',     setting_value: pubVersion, setting_type: 'text', category: 'app', description: 'Latest companion app version' },
            { setting_key: 'COMPANION_APP_DOWNLOAD_URL', setting_value: pubUrl || 'https://github.com/mannnnup-cyber/DHD-CRM-Companion/releases/latest', setting_type: 'text', category: 'app', description: 'Latest companion app APK download URL' },
          ], { onConflict: 'setting_key' });
          _releaseCache = null; // invalidate cache
          return res.json({ success: true, version: pubVersion });
        } catch (err: any) {
          return res.status(500).json({ success: false, error: err.message });
        }
      }

      case 'getInsights': {
        // GET /api/whatsapp?action=getInsights&phone=18768412776
        // Returns real call analytics for the companion app Insights tab (last 30 days)
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });
        const rawPhone = req.query.phone as string | undefined;
        if (!rawPhone) return res.status(400).json({ success: false, error: 'phone required' });
        const last10 = rawPhone.replace(/[^\d]/g, '').slice(-10);
        try {
          const since = new Date();
          since.setDate(since.getDate() - 30);
          const { data: calls, error } = await supabase
            .from('cellular_calls')
            .select('call_type, duration_seconds, called_at')
            .ilike('rep_phone', `%${last10}%`)
            .gte('called_at', since.toISOString());
          if (error) throw error;
          const all = (calls || []) as any[];
          const answered = all.filter(c => (c.duration_seconds || 0) > 0);
          const missed   = all.filter(c => c.call_type === 'MISSED');
          const incoming = all.filter(c => c.call_type === 'INCOMING');
          const outgoing = all.filter(c => c.call_type === 'OUTGOING');
          const avgDurationSec = answered.length
            ? Math.round(answered.reduce((s, c) => s + (c.duration_seconds || 0), 0) / answered.length)
            : 0;
          const answerRate = all.length ? Math.round((answered.length / all.length) * 100) : 0;
          // Heuristic sentiment derived from call duration distribution
          const positive = answered.filter(c => c.duration_seconds >= 180).length;
          const neutral  = answered.filter(c => c.duration_seconds >= 60 && c.duration_seconds < 180).length;
          const negative = answered.filter(c => c.duration_seconds < 60).length + missed.length;
          const sentTotal = (positive + neutral + negative) || 1;
          // Derive coaching topics from real call patterns
          const topics: { key: string; label: string; level: string }[] = [];
          if (answerRate >= 75) topics.push({ key: 'answer',   label: 'High Answer Rate',      level: 'high'   });
          if (missed.length > 3) topics.push({ key: 'missed',  label: 'Missed Call Follow-up', level: 'high'   });
          if (outgoing.length > incoming.length) topics.push({ key: 'outbound', label: 'Outbound Focus', level: 'medium' });
          if (avgDurationSec >= 180) topics.push({ key: 'engage', label: 'Strong Engagement',  level: 'high'   });
          if (avgDurationSec > 0 && avgDurationSec < 60) topics.push({ key: 'short', label: 'Short Call Duration', level: 'high' });
          if (incoming.length > 0) topics.push({ key: 'inbound', label: 'Inbound Response',   level: 'medium' });
          if (all.length >= 20)    topics.push({ key: 'volume',  label: 'High Call Volume',    level: 'medium' });
          if (!topics.length)      topics.push({ key: 'sync',    label: 'Sync More Calls',      level: 'low'    });
          return res.json({
            success: true, period: '30d',
            totalCalls: all.length, answered: answered.length,
            missed: missed.length, incoming: incoming.length, outgoing: outgoing.length,
            avgDurationSeconds: avgDurationSec, answerRate,
            sentiment: {
              positive: Math.round((positive / sentTotal) * 100),
              neutral:  Math.round((neutral  / sentTotal) * 100),
              negative: Math.round((negative / sentTotal) * 100),
            },
            topics,
          });
        } catch (err: any) {
          return res.status(500).json({ success: false, error: err.message });
        }
      }

      case 'updateDeviceName': {
        // POST /api/whatsapp?action=updateDeviceName
        // Body: { phone_number, device_name }
        // Lets a manager assign a friendly name (e.g. "John Smith") to a device
        if (supabase === null) return res.json({ success: false, error: 'Supabase not configured' });
        const { phone_number: devPhone, device_name: devName } = req.body;
        if (!devPhone) return res.status(400).json({ success: false, error: 'phone_number required' });
        try {
          const { error } = await supabase
            .from('devices')
            .update({ device_name: devName || null })
            .eq('phone_number', devPhone);
          if (error) throw error;
          // Also backfill rep_name on all existing cellular_calls from this device
          await supabase
            .from('cellular_calls')
            .update({ rep_name: devName || null })
            .eq('rep_phone', devPhone);
          return res.json({ success: true });
        } catch (err: any) {
          return res.json({ success: false, error: err.message });
        }
      }

      case 'getGSMCalls': {
        // GET /api/whatsapp?action=getGSMCalls&limit=100&offset=0&type=MISSED&rep=phone&date=today
        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
        const offset = parseInt(req.query.offset as string) || 0;
        const typeFilter = req.query.type as string | undefined;
        const repFilter  = req.query.rep  as string | undefined;
        const dateFilter = req.query.date as string | undefined; // 'today' | 'week' | 'month' | 'all'

        // Build date range
        const now = new Date();
        let dateFrom: string | null = null;
        if (dateFilter === 'today') {
          const d = new Date(now); d.setHours(0,0,0,0);
          dateFrom = d.toISOString();
        } else if (dateFilter === 'week') {
          const d = new Date(now); d.setDate(d.getDate() - 7);
          dateFrom = d.toISOString();
        } else if (dateFilter === 'month') {
          const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0);
          dateFrom = d.toISOString();
        }

        try {
          // Build paginated data query
          let query = supabase
            .from('cellular_calls')
            .select('*', { count: 'exact' })
            .order('called_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (typeFilter && typeFilter !== 'All') query = query.eq('call_type', typeFilter.toUpperCase());
          if (repFilter  && repFilter  !== 'all')  query = query.eq('rep_phone', repFilter);
          if (dateFrom) query = query.gte('called_at', dateFrom);

          const { data: calls, error, count } = await query;
          if (error) {
            console.error('[getGSMCalls] DB error:', error);
            return res.json({ success: false, error: error.message });
          }

          // Accurate stats — separate count queries unaffected by pagination
          let statsBase = supabase.from('cellular_calls').select('call_type, duration_seconds', { count: 'exact' });
          if (repFilter && repFilter !== 'all') statsBase = statsBase.eq('rep_phone', repFilter);
          if (dateFrom) statsBase = statsBase.gte('called_at', dateFrom);
          const { data: statsRows } = await statsBase;

          const statsData = statsRows || [];
          const statsTotal    = statsData.length;
          const statsIncoming = statsData.filter((r: any) => r.call_type === 'INCOMING').length;
          const statsOutgoing = statsData.filter((r: any) => r.call_type === 'OUTGOING').length;
          const statsMissed   = statsData.filter((r: any) => r.call_type === 'MISSED').length;
          const answered      = statsData.filter((r: any) => (r.duration_seconds || 0) > 0);
          const totalDuration = answered.reduce((s: number, r: any) => s + (r.duration_seconds || 0), 0);
          const avgDuration   = answered.length > 0 ? Math.round(totalDuration / answered.length) : 0;
          const missedRate    = statsTotal > 0 ? Math.round((statsMissed / statsTotal) * 100) : 0;

          return res.json({
            success: true,
            calls: (calls || []).map((c: any) => ({
              id: c.id,
              phoneNumber: c.phone_number,
              phoneNormalized: c.phone_normalized,
              callType: c.call_type,
              duration: c.duration_seconds,
              calledAt: c.called_at,
              contactId: c.contact_id,
              contactName: c.contact_name,
              deviceModel: c.device_model,
              rep_phone: c.rep_phone || null,
              rep_name: c.rep_name  || null,
            })),
            total: count || 0,
            stats: {
              total: statsTotal,
              incoming: statsIncoming,
              outgoing: statsOutgoing,
              missed: statsMissed,
              avgDuration,
              totalDuration,
              missedRate,
            },
            offset,
            limit
          });
        } catch (err: any) {
          console.error('[getGSMCalls] Error:', err?.message || err);
          return res.json({ success: false, error: err?.message || 'Failed to fetch GSM calls' });
        }
      }

      // ── Call Forwarding Command Queue ────────────────────────────────────────

      case 'getDeviceCommands': {
        // Companion app polls this — GET ?action=getDeviceCommands&phone=<number>
        const devicePhone = String(req.query.phone || '').replace(/[^0-9+]/g, '');
        if (!devicePhone) return res.status(400).json({ success: false, error: 'phone required' });
        if (!supabase) return res.status(500).json({ success: false, error: 'DB not configured' });

        const { data: commands } = await supabase
          .from('device_commands')
          .select('*')
          .eq('device_phone', devicePhone)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(10);

        return res.json({ success: true, commands: commands || [] });
      }

      case 'ackCommand': {
        // Companion app calls this after executing — POST ?action=ackCommand
        const { commandId, status: cmdStatus, resultMessage } = req.body;
        if (!commandId) return res.status(400).json({ success: false, error: 'commandId required' });
        if (!supabase) return res.status(500).json({ success: false, error: 'DB not configured' });

        await supabase
          .from('device_commands')
          .update({
            status: cmdStatus || 'done',
            executed_at: new Date().toISOString(),
            result_message: resultMessage || null,
          })
          .eq('id', commandId);

        return res.json({ success: true });
      }

      case 'sendForwardCommand': {
        // CRM website creates a forwarding command — POST ?action=sendForwardCommand
        // Only managers and owners can send commands
        const { devicePhone: fwdPhone, command: fwdCmd, targetNumber, simSlot } = req.body;

        if (!fwdPhone || !fwdCmd) return res.status(400).json({ success: false, error: 'devicePhone and command required' });
        if (!supabase) return res.status(500).json({ success: false, error: 'DB not configured' });

        // Normalize and validate phone number format
        const normalizedPhone = String(fwdPhone).replace(/[^0-9+]/g, '');
        if (normalizedPhone.length < 7) {
          return res.status(400).json({ success: false, error: 'Invalid device phone format' });
        }

        // Validate command
        if (!['forward_enable', 'forward_disable'].includes(fwdCmd)) {
          return res.status(400).json({ success: false, error: 'Invalid command' });
        }

        // Validate target number for enable command
        if (fwdCmd === 'forward_enable') {
          if (!targetNumber) return res.status(400).json({ success: false, error: 'targetNumber required for forward_enable' });
          const cleanTarget = String(targetNumber).replace(/[^0-9+]/g, '');
          if (cleanTarget.length < 7) {
            return res.status(400).json({ success: false, error: 'Invalid target number format (min 7 digits)' });
          }
        }

        // Validate SIM slot (0 or 1)
        const simSlotNum = Number(simSlot ?? 0);
        if (![0, 1].includes(simSlotNum)) {
          return res.status(400).json({ success: false, error: 'Invalid SIM slot (must be 0 or 1)' });
        }

        // Verify device exists in database
        const { data: deviceExists } = await supabase
          .from('app_devices')
          .select('device_id')
          .eq('phone_number', normalizedPhone)
          .limit(1)
          .maybeSingle();

        if (!deviceExists) {
          return res.status(400).json({ success: false, error: 'Device not found or phone number not registered' });
        }

        // Cancel any existing pending commands for this device to prevent stacking
        await supabase
          .from('device_commands')
          .update({ status: 'cancelled' })
          .eq('device_phone', normalizedPhone)
          .eq('status', 'pending');

        // Create new command
        const { data: newCmd, error: cmdErr } = await supabase
          .from('device_commands')
          .insert({
            device_phone: normalizedPhone,
            command: fwdCmd,
            target_number: fwdCmd === 'forward_enable' ? String(targetNumber).replace(/[^0-9+]/g, '') : null,
            sim_slot: simSlotNum,
            created_by: String(req.headers['x-user-email'] || 'system'),
            status: 'pending',
          })
          .select()
          .single();

        if (cmdErr) return res.status(500).json({ success: false, error: cmdErr.message });
        return res.json({ success: true, command: newCmd });
      }

      case 'getForwardStatus': {
        // Returns latest command per device so the UI knows each device's forwarding state
        if (!supabase) return res.status(500).json({ success: false, error: 'DB not configured' });

        const { data: recentCmds } = await supabase
          .from('device_commands')
          .select('*')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(200);

        // Keep only the latest command per device
        const byDevice: Record<string, any> = {};
        for (const cmd of (recentCmds || [])) {
          if (!byDevice[cmd.device_phone]) byDevice[cmd.device_phone] = cmd;
        }

        return res.json({ success: true, forwardStatus: byDevice });
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: [
            // Chat & Message actions
            'messages', 'chats', 'chatsFromDb', 'send', 'sendMedia', 'sendAudio', 'messageCount', 'mediaProxy',
            // Search & Filtering
            'searchMessages', 'searchUnified',
            // WhatsApp call management
            'getCalls', 'getAllCalls', 'bulkUpdateChats',
            // GSM companion app
            'addGSMCall', 'getGSMCalls',
            // Call forwarding
            'getDeviceCommands', 'ackCommand', 'sendForwardCommand', 'getForwardStatus',
            // Instance management
            'createInstance', 'getQRCode', 'getInstanceStatus', 'disconnect', 'webhookConfig', 'setWebhook', 'syncEvolutionMessages',
            // Utilities
            'diagnostics'
          ]
        });
    }
  } catch (err: any) {
    console.error('WhatsApp API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
