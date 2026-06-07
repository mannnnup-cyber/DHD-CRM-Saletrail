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
    const { data, error } = await supabase
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
            let mediaUrl = null;
            if (body.data?.message) {
              const msg = body.data.message;
              mediaUrl =
                msg.imageMessage?.downloadUrl ||
                msg.videoMessage?.downloadUrl ||
                msg.audioMessage?.downloadUrl ||
                msg.documentMessage?.downloadUrl ||
                msg.stickerMessage?.downloadUrl ||
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
      if (provider === 'evolution' && typeWebhook === 'call') {
        console.log('[Webhook] CALL event received:', { chatId: body.data?.remoteJid, callType: body.data?.callType, status: body.data?.status });

        if (supabase !== null && body.data?.remoteJid) {
          const callChatId = body.data.remoteJid;
          const callId = body.data.id || `${callChatId}_${Date.now()}`;
          const callType = body.data.callType || 'voice'; // 'voice' or 'video'
          const callStatus = body.data.status || 'missed'; // 'answered', 'missed', 'rejected'
          const callStarted = body.data.timestamp ? new Date(body.data.timestamp * 1000).toISOString() : new Date().toISOString();
          const callEnded = body.data.endedAt ? new Date(body.data.endedAt * 1000).toISOString() : null;
          const callDuration = body.data.duration || 0; // seconds

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

      case 'setWebhook': {
        // Set webhook for Evolution API
        const { webhookUrl } = req.body;
        const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        try {
          const webhookSetUrl = new URL(`/webhook/set/${instanceName}`, EVOLUTION_API_URL).toString();
          const events = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

          const r = await fetch(webhookSetUrl, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: webhookUrl || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/whatsapp`,
              events,
              enabled: true,
              webhookByEvents: true,
              webhookBase64: false
            })
          });

          const data = await r.json();
          return res.json({
            success: r.ok,
            data,
            message: r.ok ? 'Webhook configured successfully' : 'Failed to configure webhook'
          });
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
          const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'evolution');
          const activePhone = activeProvider === 'evolution'
            ? await getSetting('EVOLUTION_PHONE', '')
            : '';

          // Fetch recent messages for chat aggregation (sorted newest first)
          const { data: msgs } = await supabase
            .from('whatsapp_messages')
            .select('chat_id, body, created_at, direction, sender_name, provider')
            .order('created_at', { ascending: false })
            .limit(2000);

          // Filter to Evolution API messages only
          const filteredMsgs = (msgs || []).filter((m: any) =>
            m.provider === 'evolution' || (m.provider === null && activePhone && m.chat_id?.includes(activePhone))
          );

          // Load persisted chat metadata (status, assignedTo, contact_name for @lid resolution)
          const { data: chatMeta } = await supabase
            .from('whatsapp_chats')
            .select('chat_id, status, assigned_to, contact_name');
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
                assignedTo: meta?.assigned_to || 'Unassigned'
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
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 300);
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
            type: m.message_type || 'text',
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
        if (!mediaUrl) return res.status(400).json({ error: 'url required' });
        let parsed: URL;
        try { parsed = new URL(mediaUrl); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
        if (parsed.protocol !== 'https:') return res.status(400).json({ error: 'HTTPS only' });
        const mr = await fetch(mediaUrl);
        const ct = mr.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const buf = await mr.arrayBuffer();
        return res.send(Buffer.from(buf));
      }

      case 'send': {
        const { chatId, message } = req.body;
        if (!chatId || !message) {
          return res.status(400).json({ success: false, error: 'chatId and message are required' });
        }

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
              raw: rawData,
              created_at: new Date().toISOString()
            });
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

      case 'sendMedia': {
        // Send images, videos, or documents via Evolution API
        const { chatId, mediaBase64, mediaType, fileName, caption, mimeType } = req.body;
        if (!chatId || !mediaBase64 || !mediaType || !fileName) {
          return res.status(400).json({ error: 'chatId, mediaBase64, mediaType, fileName required' });
        }

        const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        if (!instanceName) {
          return res.status(400).json({ success: false, error: 'Evolution API not linked' });
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          return res.status(400).json({ success: false, error: 'Evolution API not configured' });
        }

        let messageId = 'unknown';
        let rawData: any = {};

        // Determine Evolution mediatype
        let evolutionMediaType = 'document';
        if (mediaType.toLowerCase().includes('image')) evolutionMediaType = 'Image';
        else if (mediaType.toLowerCase().includes('video')) evolutionMediaType = 'video';

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
              mimetype: mimeType || 'application/octet-stream',
              caption: caption || '',
              media: `data:${mimeType || 'application/octet-stream'};base64,${mediaBase64}`,
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

          // Get contact names for each call
          const chatIds = [...new Set((calls || []).map((c: any) => c.chat_id))];
          const { data: chatMeta } = await supabase
            .from('whatsapp_chats')
            .select('chat_id, contact_name')
            .in('chat_id', chatIds);

          const contactMap: Record<string, string> = {};
          (chatMeta || []).forEach((row: any) => {
            contactMap[row.chat_id] = row.contact_name || '';
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
            calls: sorted.map((call: any) => ({
              id: call.id,
              chatId: call.chat_id,
              contactName: contactMap[call.chat_id] || call.chat_id.replace(/@[a-z.]+$/, ''),
              callType: call.call_type, // 'voice' or 'video'
              status: call.status, // 'answered', 'missed', 'rejected'
              duration: call.duration_seconds,
              timestamp: call.started_at
            }))
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

          // 2. Search chats by contact name or phone
          const { data: chats } = await supabase
            .from('whatsapp_chats')
            .select('*')
            .or(`contact_name.ilike.${searchPattern},chat_id.ilike.${searchPattern}`)
            .limit(10);

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
                phone: chat.chat_id.replace(/@[a-z.]+$/, '') // Extract phone from JID
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
          return {
            provider: 'evolution',
            provider_message_id: msg.key?.id,
            chat_id: msg.key?.remoteJid || jid,
            sender_name: msg.pushName || chatName || '',
            direction: msg.key?.fromMe ? 'outbound' : 'inbound',
            body: msgText || (msg.messageType ? `[${msg.messageType}]` : ''),
            type: msg.messageType || 'conversation',
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
              return res.json({ success: true, message: 'Single chat synced', count: toInsert.length });
            }
            return res.json({ success: true, message: 'No messages found', count: 0 });
          }

          // Sync batch of recent chats (sorted by updatedAt descending)
          console.log('[syncEvolutionMessages] Syncing recent chats, offset:', chatOffset, 'limit:', maxChats);
          const chatsUrl = new URL(`/chat/findChats/${instanceName}`, EVOLUTION_API_URL).toString();
          const chatsRes = await fetch(chatsUrl, {
            method: 'POST',
            headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });

          if (!chatsRes.ok) {
            console.error('[syncEvolutionMessages] Failed to get chats:', chatsRes.status);
            return res.json({ success: false, error: 'Failed to fetch chats' });
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
        const { chatId, status, assignedTo } = req.body;
        if (!supabase || !chatId || !status) {
          return res.status(400).json({ success: false, error: 'Missing chatId or status' });
        }
        const { error } = await supabase.from('whatsapp_chats').upsert(
          { chat_id: chatId, status, assigned_to: assignedTo || 'Unassigned', updated_at: new Date().toISOString() },
          { onConflict: 'chat_id' }
        );
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.json({ success: true, chatId, status });
      }

      case 'getChatStatuses': {
        // Return all persisted chat statuses so the UI can restore state after refresh
        if (!supabase) return res.json({ success: true, statuses: {} });
        const { data, error } = await supabase
          .from('whatsapp_chats')
          .select('chat_id, status, assigned_to, contact_name');
        if (error) return res.status(500).json({ success: false, error: error.message });
        // Return as a map: { [chatId]: { status, assignedTo, contactName } }
        const statuses: Record<string, any> = {};
        (data || []).forEach((row: any) => {
          statuses[row.chat_id] = { status: row.status, assignedTo: row.assigned_to, contactName: row.contact_name };
        });
        return res.json({ success: true, statuses });
      }

      // ── Contact name resolution for @lid JIDs ────────────────────────────
      case 'syncContactNames': {
        // Fetch contacts from Evolution API and store name+phone mappings
        // so @lid JIDs can be resolved to real names in the chat list
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

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: [
            // Chat & Message actions
            'messages', 'chats', 'chatsFromDb', 'send', 'sendMedia', 'sendAudio', 'messageCount', 'mediaProxy',
            // Search & Filtering
            'searchMessages', 'searchUnified',
            // Call management
            'getCalls', 'bulkUpdateChats',
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
