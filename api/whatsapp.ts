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
const _supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _supabaseUrl && _supabaseKey ? createClient(_supabaseUrl, _supabaseKey) : null;

const supaDb = {
  createCall: async (call: any) => {
    if (!supabase) return;
    await supabase.from('calls').insert(call);
  }
};

// Use environment variables for security
const INSTANCE_ID = process.env.GREENAPI_INSTANCE_ID || '';
const API_TOKEN = process.env.GREENAPI_TOKEN || '';
const BASE_URL = INSTANCE_ID ? `https://api.green-api.com/waInstance${INSTANCE_ID}` : '';

// Evolution API configuration
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:3001';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// Helper to get a setting from Supabase with caching
const _settingCache: Record<string, { value: string; ts: number }> = {};
const SETTING_CACHE_TTL = 60000; // 60 seconds

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

    try {
      // Detect provider and extract message data
      let provider = 'unknown';
      let typeWebhook = body?.typeWebhook;
      let isInbound = false;
      let chatId = '';
      let senderName = '';
      let messageId = '';
      let timestamp = 0;
      let text = '';
      let msgType = 'textMessage';

      // ===== GREEN API WEBHOOK FORMAT =====
      if (body?.typeWebhook) {
        // Green API has typeWebhook field
        provider = 'greenapi';
        typeWebhook = body.typeWebhook;

        if (typeWebhook === 'incomingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived' || typeWebhook === 'outgoingMessageReceived') {
          isInbound = typeWebhook === 'incomingMessageReceived';
          chatId = isInbound
            ? (body.senderData?.chatId || body.senderData?.sender)
            : (body.messageData?.chatId || body.senderData?.chatId);
          senderName = body.senderData?.senderName || '';
          messageId = body.idMessage;
          timestamp = body.timestamp || 0;

          const msgData = body.messageData || {};
          text =
            msgData.textMessageData?.textMessage ||
            msgData.extendedTextMessageData?.text ||
            msgData.imageMessageData?.caption ||
            msgData.videoMessageData?.caption ||
            msgData.documentMessageData?.caption ||
            (msgData.typeMessage ? `[${msgData.typeMessage}]` : '');
          msgType = msgData.typeMessage || 'textMessage';
        }
      }
      // ===== EVOLUTION API WEBHOOK FORMAT =====
      else if (body?.event) {
        // Evolution API uses 'event' field (Baileys-based)
        provider = 'evolution';
        typeWebhook = body.event;

        if (typeWebhook === 'messages.upsert') {
          const message = body.data?.messages?.[0];
          if (message) {
            isInbound = !message.fromMe;
            chatId = message.chatId || message.from || '';
            senderName = body.data?.contacts?.[0]?.pushName || '';
            messageId = message.id || message.key?.id;
            timestamp = (message.timestamp || 0) * 1000; // Convert to ms if needed

            text = message.body || message.text || '';
            if (!text && message.caption) text = message.caption;
            if (!text && message.type) text = `[${message.type}]`;

            msgType = message.type || 'text';
          }
        }
      }

      // Only store actual messages — ignore state/ack events
      if ((provider === 'greenapi' && (typeWebhook === 'incomingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived' || typeWebhook === 'outgoingMessageReceived')) ||
          (provider === 'evolution' && typeWebhook === 'messages.upsert')) {

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

            const msgAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

            const { data: inserted } = await supabase.from('whatsapp_messages').insert({
              provider,
              provider_message_id: messageId,
              chat_id: chatId,
              sender_name: senderName,
              direction: isInbound ? 'inbound' : 'outbound',
              body: text,
              type: msgType,
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
    } catch (err) {
      console.error('Webhook processing error:', err);
    }

    return res.status(200).json({ success: true });
  }

  const action = req.query.action as string;

  // Allow webhookInfo and settings without requiring credentials (for status display)
  if ((action === 'webhookInfo' || action === 'settings' || action === 'status') && (!INSTANCE_ID || !API_TOKEN)) {
    return res.json({
      success: false,
      configured: false,
      url: '',
      message: 'WhatsApp credentials not configured',
      connected: false
    });
  }

  // For other actions, require credentials
  if (!INSTANCE_ID || !API_TOKEN) {
    return res.status(400).json({
      success: false,
      error: 'WhatsApp credentials not configured',
      message: 'Please set GREENAPI_INSTANCE_ID and GREENAPI_TOKEN environment variables in Vercel'
    });
  }

  try {
    switch (action) {

      case 'status': {
        // Get instance state - check if authorized
        const r = await fetch(`${BASE_URL}/getStateInstance/${API_TOKEN}`);
        const data = await r.json();
        return res.json({
          success: true,
          connected: data.stateInstance === 'authorized',
          state: data.stateInstance
        });
      }

      case 'settings': {
        // Get all instance settings (includes webhookUrl)
        const r = await fetch(`${BASE_URL}/getSettings/${API_TOKEN}`);
        const data = await r.json();
        return res.json({
          success: true,
          settings: data,
          // Check if webhook is configured (webhookUrl is not empty)
          webhookConfigured: !!(data.webhookUrl && data.webhookUrl.length > 0),
          webhookUrl: data.webhookUrl || ''
        });
      }

      case 'webhookInfo': {
        // Get webhook settings using getSettings (no separate getWebhookUrl exists)
        const r = await fetch(`${BASE_URL}/getSettings/${API_TOKEN}`);
        const data = await r.json();
        return res.json({
          success: true,
          configured: !!(data.webhookUrl && data.webhookUrl.length > 0),
          url: data.webhookUrl || '',
          incomingWebhook: data.incomingWebhook === 'yes',
          outgoingWebhook: data.outgoingWebhook === 'yes',
          stateWebhook: data.stateWebhook === 'yes',
          raw: data
        });
      }

      case 'setWebhook': {
        // Set webhook using SetSettings (no separate setWebhookUrl exists)
        const { webhookUrl, webhookUrlToken, incomingWebhook, outgoingWebhook, stateWebhook } = req.body;
        const settings: any = {};

        if (webhookUrl !== undefined) settings.webhookUrl = webhookUrl;
        if (webhookUrlToken !== undefined) settings.webhookUrlToken = webhookUrlToken;
        if (incomingWebhook !== undefined) settings.incomingWebhook = incomingWebhook ? 'yes' : 'no';
        if (outgoingWebhook !== undefined) settings.outgoingWebhook = outgoingWebhook ? 'yes' : 'no';
        if (stateWebhook !== undefined) settings.stateWebhook = stateWebhook ? 'yes' : 'no';

        const r = await fetch(`${BASE_URL}/SetSettings/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await r.json();
        return res.json({ success: data.saveSettings === true, data });
      }

      case 'contacts': {
        // Get all contacts
        const r = await fetch(`${BASE_URL}/getContacts/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, contacts: data });
      }

      case 'chats': {
        // Use getChats — returns actual open conversations with last messages
        const r = await fetch(`${BASE_URL}/getChats/${API_TOKEN}`);
        const rawChats = await r.json();

        const chats = Array.isArray(rawChats)
          ? rawChats.slice(0, 50).map((c: any) => {
              const lastMsg = c.lastMessage || {};
              const lastText = lastMsg.textMessage || lastMsg.caption || (lastMsg.typeMessage ? `[${lastMsg.typeMessage}]` : '');
              const phone = (c.id || '').replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@g.us', '');
              return {
                id: c.id || '',
                name: c.name || c.pushname || phone || 'Unknown',
                phone,
                lastMessage: lastText.slice(0, 80),
                timestamp: lastMsg.timestamp
                  ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '',
                rawTimestamp: lastMsg.timestamp || 0,
                unread: c.unreadCount || 0,
                status: 'active'
              };
            }).sort((a: any, b: any) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0))
          : [];

        return res.json({ success: true, chats });
      }

      case 'chatsFromDb': {
        // Read recent chats aggregated from whatsapp_messages table
        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
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
          console.error('chatsFromDb error', err);
          return res.json({ success: false, error: String(err) });
        }
      }

      case 'syncHistory': {
        // Use getChats for the chat list (real conversations, not address book)
        const r = await fetch(`${BASE_URL}/getChats/${API_TOKEN}`);
        const rawChats = await r.json();

        if (!Array.isArray(rawChats)) {
          return res.json({ success: true, chats: [], messages: {} });
        }

        const chatsWithHistory: any[] = [];
        const chatMessages: Record<string, any[]> = {};
        const recentChats = rawChats.slice(0, 50); // top 50 chats

        for (const chat of recentChats) {
          const chatId = chat.id;
          if (!chatId) continue;

          const phone = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@g.us', '');
          const lastMsg = chat.lastMessage || {};
          const lastMsgText = lastMsg.textMessage || lastMsg.caption || (lastMsg.typeMessage ? `[${lastMsg.typeMessage}]` : '');

          try {
            const historyRes = await fetch(`${BASE_URL}/getChatHistory/${API_TOKEN}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId, count: 100 })
            });
            const history = await historyRes.json();

            if (Array.isArray(history) && history.length > 0) {
              const newest = history[0];
              chatsWithHistory.push({
                id: chatId,
                name: chat.name || chat.pushname || phone || 'Unknown',
                phone,
                lastMessage: (newest.textMessage || newest.caption || lastMsgText || '').slice(0, 80),
                timestamp: newest.timestamp
                  ? new Date(newest.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '',
                rawTimestamp: newest.timestamp || lastMsg.timestamp || 0,
                unread: chat.unreadCount || 0,
                status: 'active'
              });

              chatMessages[chatId] = history.map((msg: any) => ({
                id: msg.idMessage || msg.id || Math.random().toString(),
                text: msg.textMessage || msg.text || msg.caption || '',
                timestamp: msg.timestamp
                  ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '',
                fromMe: msg.fromMe === true || msg.type === 'outgoing',
                status: 'read',
                type: msg.typeMessage || msg.type || 'text',
                mediaUrl: msg.imageMessage?.downloadUrl || msg.videoMessage?.downloadUrl ||
                          msg.audioMessage?.downloadUrl || msg.documentMessage?.downloadUrl || undefined
              })).reverse();

              // Persist to DB so future loads skip Green API entirely
              if (supabase) {
                const toInsert = history
                  .filter((msg: any) => msg.idMessage)
                  .map((msg: any) => ({
                    provider: 'greenapi',
                    provider_message_id: msg.idMessage,
                    chat_id: chatId,
                    sender_name: msg.fromMe ? '' : (chat.name || chat.pushname || ''),
                    direction: (msg.fromMe === true || msg.type === 'outgoing') ? 'outbound' : 'inbound',
                    body: msg.textMessage || msg.caption || '',
                    type: msg.typeMessage || 'textMessage',
                    raw: msg,
                    created_at: msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString()
                  }));
                if (toInsert.length > 0) {
                  await supabase.from('whatsapp_messages').upsert(toInsert, { onConflict: 'provider_message_id', ignoreDuplicates: true });
                }
              }
            } else {
              chatsWithHistory.push({
                id: chatId,
                name: chat.name || chat.pushname || phone || 'Unknown',
                phone,
                lastMessage: lastMsgText.slice(0, 80),
                timestamp: lastMsg.timestamp
                  ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '',
                rawTimestamp: lastMsg.timestamp || 0,
                unread: chat.unreadCount || 0,
                status: 'active'
              });
            }
          } catch (err) {
            console.error(`Error fetching history for ${chatId}:`, err);
            chatsWithHistory.push({
              id: chatId,
              name: chat.name || chat.pushname || phone || 'Unknown',
              phone,
              lastMessage: lastMsgText.slice(0, 80),
              timestamp: '',
              rawTimestamp: lastMsg.timestamp || 0,
              unread: chat.unreadCount || 0,
              status: 'active'
            });
          }
        }

        chatsWithHistory.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

        return res.json({
          success: true,
          chats: chatsWithHistory,
          messages: chatMessages,
          synced: true,
          count: chatsWithHistory.length
        });
      }

      case 'messages': {
        // Get chat history (DB-backed if possible)
        const chatId = req.query.chatId as string;
        if (supabase !== null && chatId) {
          try {
            const { data: msgs } = await supabase.from('whatsapp_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(1000);
            if (msgs && msgs.length > 0) {
              const formatted = msgs.map((m: any) => {
                const msgData = (m.raw || {}).messageData || {};
                const mediaUrl =
                  msgData.imageMessageData?.downloadUrl ||
                  msgData.videoMessageData?.downloadUrl ||
                  msgData.audioMessageData?.downloadUrl ||
                  msgData.documentMessageData?.downloadUrl || null;
                return {
                  id: m.provider_message_id || m.id,
                  text: m.body || '',
                  timestamp: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : 0,
                  fromMe: m.direction === 'outbound',
                  status: 'read',
                  type: m.type || 'text',
                  mediaUrl
                };
              });
              return res.json({ success: true, messages: formatted, source: 'db' });
            }
          } catch (err) {
            console.error('messagesFromDb error', err);
          }
        }

        // Fallback to provider chat history
        const r = await fetch(`${BASE_URL}/getChatHistory/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, count: 100 })
        });
        const data = await r.json();
        return res.json({ success: true, messages: data, source: 'provider' });
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

        // Get active provider from settings (default to greenapi for backward compatibility)
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');

        let succeeded = false;
        let messageId: string | undefined;
        let rawData: any = {};

        if (activeProvider === 'evolution') {
          // Route to Evolution API
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName) {
            return res.status(400).json({ success: false, error: 'Evolution API not linked (no instance name)' });
          }

          const evolutionUrl = new URL(`/instance/${instanceName}/send`, EVOLUTION_API_URL).toString();
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

            // Evolution API returns { status: 'success', data: { key: {...} } } or similar
            succeeded = r.ok && (rawData.status === 'success' || !!rawData.key);
            messageId = rawData.key?.id || rawData.data?.key?.id || 'unknown';

            if (!succeeded) {
              const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
              console.error('Evolution API send failed:', errMsg, 'chatId:', chatId);
              return res.json({ success: false, error: errMsg, raw: rawData });
            }
          } catch (err: any) {
            console.error('Evolution API send error:', err.message);
            return res.json({ success: false, error: err.message });
          }
        } else {
          // Route to Green API (default)
          if (!INSTANCE_ID || !API_TOKEN) {
            return res.status(400).json({ success: false, error: 'Green API not configured' });
          }

          const r = await fetch(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message })
          });
          rawData = await r.json();

          succeeded = !!rawData.idMessage;
          messageId = rawData.idMessage;

          if (!succeeded) {
            const errMsg = rawData.message || rawData.error || rawData.description || JSON.stringify(rawData);
            console.error('Green API sendMessage failed:', errMsg, 'chatId:', chatId);
            return res.json({ success: false, error: errMsg, raw: rawData });
          }
        }

        // Persist outgoing message
        try {
          if (supabase !== null) {
            await supabase.from('whatsapp_messages').insert({
              provider: activeProvider,
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: message,
              raw: rawData,
              created_at: new Date().toISOString()
            });
          }
          await supaDb.createCall({
            type: 'WhatsApp',
            contactPhone: String(chatId || ''),
            duration: 0,
            notes: `Outbound WhatsApp: ${String(message || '').slice(0, 200)}`,
            repId: null,
            timestamp: new Date().toISOString()
          } as any);
        } catch (err) {
          console.error('Failed to persist outgoing whatsapp message:', err);
        }

        return res.json({ success: true, messageId });
      }

      case 'receive': {
        // Receive incoming notifications (long polling) - HTTP API method
        const r = await fetch(`${BASE_URL}/receiveNotification/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, notification: data });
      }

      case 'deleteNotification': {
        // Delete notification after processing
        const receiptId = req.query.receiptId as string;
        const r = await fetch(`${BASE_URL}/deleteNotification/${API_TOKEN}/${receiptId}`, {
          method: 'DELETE'
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'checkWhatsapp': {
        // Check if phone number has WhatsApp
        const phone = req.query.phone as string;
        const r = await fetch(`${BASE_URL}/CheckWhatsapp/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'avatar': {
        const chatId = req.query.chatId as string;
        if (!chatId) return res.status(400).json({ error: 'chatId required' });
        const r = await fetch(`${BASE_URL}/getAvatar/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId })
        });
        const data = await r.json();
        return res.json({ success: true, url: data.urlAvatar || null, available: !!data.urlAvatar });
      }

      case 'readChat': {
        const { chatId } = req.body;
        if (!chatId) return res.status(400).json({ error: 'chatId required' });
        const r = await fetch(`${BASE_URL}/readChat/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId })
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'archiveChat': {
        const { chatId } = req.body;
        if (!chatId) return res.status(400).json({ error: 'chatId required' });
        const r = await fetch(`${BASE_URL}/archiveChat/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId })
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'sendFile': {
        const { chatId, fileBase64, fileName, caption, mimeType } = req.body;
        if (!chatId || !fileBase64 || !fileName) {
          return res.status(400).json({ error: 'chatId, fileBase64, fileName required' });
        }
        const buffer = Buffer.from(fileBase64, 'base64');
        const { FormData: NodeFormData, Blob: NodeBlob } = await import('node:buffer') as any;
        const fd = new (globalThis.FormData || NodeFormData)();
        fd.append('chatId', chatId);
        fd.append('caption', caption || '');
        fd.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), fileName);
        const r = await fetch(`${BASE_URL}/sendFileByUpload/${API_TOKEN}`, { method: 'POST', body: fd as any });
        const data = await r.json();
        if (!data.idMessage) {
          return res.json({ success: false, error: data.message || data.error || JSON.stringify(data) });
        }
        if (supabase) {
          await supabase.from('whatsapp_messages').insert({
            provider: 'greenapi', provider_message_id: data.idMessage, chat_id: chatId,
            direction: 'outbound', body: caption || `[File: ${fileName}]`,
            type: 'documentMessage', raw: data, created_at: new Date().toISOString()
          });
        }
        return res.json({ success: true, messageId: data.idMessage });
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
        // GET /api/whatsapp?action=webhookConfig
        // Returns webhook configuration info for setting up Evolution API
        const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        const isAuthenticatedEvo = !!instanceName;

        // For Green API, read from current settings
        const r = await fetch(`${BASE_URL}/getSettings/${API_TOKEN}`);
        const greenApiData = await r.json();
        const greenApiWebhookUrl = greenApiData?.webhookUrl || '';
        const greenApiConfigured = !!greenApiWebhookUrl;

        return res.json({
          success: true,
          greenApi: {
            configured: greenApiConfigured,
            webhookUrl: greenApiWebhookUrl,
            webhookConfigured: greenApiConfigured
          },
          evolution: {
            configured: isAuthenticatedEvo,
            instanceName,
            webhookInstructions: {
              note: 'Configure webhook in Evolution API dashboard',
              webhookUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/whatsapp`,
              events: ['messages.upsert', 'message.update'],
              messageFormat: 'Baileys (from Evolution API)'
            }
          }
        });
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

          if (!deleteRes.ok) {
            console.error('[whatsapp] Evolution disconnect failed:', deleteData);
            return res.status(400).json({
              success: false,
              error: deleteData.error || 'Failed to disconnect instance'
            });
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
        // Temporary debug endpoint - saves instance name directly (for emergencies)
        const { instanceName } = req.body;
        if (!instanceName) {
          return res.status(400).json({ error: 'instanceName required' });
        }
        const saved = await setSetting('EVOLUTION_INSTANCE_NAME', instanceName);
        if (saved) {
          return res.json({ success: true, message: 'Instance name saved', instanceName });
        } else {
          return res.status(500).json({ success: false, error: 'Failed to save' });
        }
      }

      case 'selectProvider': {
        // POST /api/whatsapp?action=selectProvider
        // Switches between Green API and Evolution API for sending messages
        const { provider } = req.body;

        if (provider !== 'greenapi' && provider !== 'evolution') {
          return res.status(400).json({
            success: false,
            error: 'Provider must be "greenapi" or "evolution"'
          });
        }

        // Validate provider is available
        if (provider === 'greenapi' && (!INSTANCE_ID || !API_TOKEN)) {
          return res.status(400).json({
            success: false,
            error: 'Green API not configured (missing GREENAPI_INSTANCE_ID or GREENAPI_TOKEN env vars)'
          });
        }

        if (provider === 'evolution') {
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName) {
            return res.status(400).json({
              success: false,
              error: 'Evolution API not linked (run "Link WhatsApp" first in Settings)'
            });
          }
        }

        // Save to app_settings
        const saved = await setSetting('WHATSAPP_ACTIVE_PROVIDER', provider);

        if (!saved) {
          return res.status(500).json({
            success: false,
            error: 'Failed to save provider preference'
          });
        }

        return res.json({
          success: true,
          activeProvider: provider,
          message: `Switched to ${provider === 'evolution' ? 'Evolution API' : 'Green API'}`
        });
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: [
            // Green API actions
            'status', 'settings', 'webhookInfo', 'setWebhook', 'contacts', 'chats', 'messages', 'send', 'receive', 'deleteNotification', 'checkWhatsapp', 'avatar', 'readChat', 'archiveChat', 'sendFile', 'searchMessages', 'mediaProxy', 'messageCount',
            // Evolution API actions
            'createInstance', 'getQRCode', 'getInstanceStatus', 'disconnect', 'webhookConfig', 'selectProvider'
          ]
        });
    }
  } catch (err: any) {
    console.error('WhatsApp API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
