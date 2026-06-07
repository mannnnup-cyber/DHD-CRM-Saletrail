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

// Use environment variables for security
const INSTANCE_ID = process.env.GREENAPI_INSTANCE_ID || '';
const API_TOKEN = process.env.GREENAPI_TOKEN || '';
const BASE_URL = INSTANCE_ID ? `https://api.green-api.com/waInstance${INSTANCE_ID}` : '';

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
      if ((provider === 'greenapi' && (typeWebhook === 'incomingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived' || typeWebhook === 'outgoingMessageReceived')) ||
          (provider === 'evolution' && typeWebhook === 'messages.upsert')) {

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
        // Set webhook for Green API or Evolution API
        const { webhookUrl, webhookUrlToken, incomingWebhook, outgoingWebhook, stateWebhook } = req.body;
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');

        if (activeProvider === 'evolution') {
          // Set webhook for Evolution API
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName) {
            return res.status(400).json({ success: false, error: 'Evolution API not linked' });
          }

          if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return res.status(400).json({ success: false, error: 'Evolution API not configured' });
          }

          try {
            const webhookSetUrl = new URL(`/webhook/set/${instanceName}`, EVOLUTION_API_URL).toString();

            // Default events for Evolution API webhook
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
            console.log('[Evolution setWebhook] Response:', JSON.stringify(data));

            return res.json({
              success: r.ok,
              provider: 'evolution',
              data,
              message: r.ok ? 'Webhook configured successfully' : 'Failed to configure webhook'
            });
          } catch (err: any) {
            console.error('[Evolution setWebhook] Error:', err.message);
            return res.json({ success: false, error: err.message });
          }
        } else {
          // Set webhook for Green API (existing logic)
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
      }

      case 'contacts': {
        // Get all contacts
        const r = await fetch(`${BASE_URL}/getContacts/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, contacts: data });
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

      case 'chatsLegacy': {
        // Legacy: fetch from Green API or Evolution API directly
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');

        let rawChats: any = [];

        if (activeProvider === 'evolution') {
          // Fetch from Evolution API
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName) {
            return res.status(400).json({ success: false, error: 'Evolution API not linked' });
          }

          if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return res.status(400).json({ success: false, error: 'Evolution API not configured' });
          }

          try {
            const chatsUrl = new URL(`/chat/findChats/${instanceName}`, EVOLUTION_API_URL).toString();
            const r = await fetch(chatsUrl, {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            });

            if (r.ok) {
              const data = await r.json();
              // Evolution API returns an array directly
              rawChats = Array.isArray(data) ? data : (data.chats || data.data || []);
              console.log('[Evolution getChats] Found', rawChats.length, 'chats');
            } else {
              console.error('[Evolution getChats] Failed:', r.status);
              rawChats = [];
            }
          } catch (err: any) {
            console.error('[Evolution getChats] Error:', err.message);
            rawChats = [];
          }
        } else {
          // Fetch from Green API (default)
          const r = await fetch(`${BASE_URL}/getChats/${API_TOKEN}`);
          rawChats = await r.json();
        }

        const chats = Array.isArray(rawChats)
          ? rawChats.slice(0, 100).map((c: any) => {
              // Evolution API: uses remoteJid, lastMessage.key, lastMessage.message.conversation
              // Green API: uses id, lastMessage.textMessage, lastMessage.timestamp
              const chatId = c.remoteJid || c.id || '';
              const lastMsg = c.lastMessage || {};
              const lastMsgKey = lastMsg.key || {};

              // Extract last message text for Evolution API format
              const evoText = lastMsg.message?.conversation ||
                              lastMsg.message?.extendedTextMessage?.text ||
                              lastMsg.message?.imageMessage?.caption ||
                              (lastMsg.messageType ? `[${lastMsg.messageType}]` : '');

              const lastText = evoText ||
                               lastMsg.textMessage ||
                               lastMsg.caption ||
                               (lastMsg.typeMessage ? `[${lastMsg.typeMessage}]` : '');

              const phone = chatId.replace(/@[^@]+$/, '');
              // Evolution: pushName on chat or last message's pushName
              const contactName = c.pushName || lastMsg.pushName || '';

              return {
                id: chatId,
                name: contactName || phone || 'Unknown',
                phone,
                lastMessage: lastText.slice(0, 80),
                timestamp: lastMsg.messageTimestamp
                  ? new Date(lastMsg.messageTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : (lastMsg.timestamp ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
                rawTimestamp: lastMsg.messageTimestamp || lastMsg.timestamp || 0,
                unread: c.unreadCount || 0,
                status: 'active'
              };
            }).sort((a: any, b: any) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0))
          : [];

        return res.json({ success: true, chats });
      }

      case 'chatsFromDb': {
        // Read recent chats aggregated from whatsapp_messages table, filtered by active provider
        if (supabase === null) {
          return res.json({ success: false, error: 'Supabase not configured' });
        }

        try {
          const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');
          const activePhone = activeProvider === 'evolution'
            ? await getSetting('EVOLUTION_PHONE', '')
            : '';

          // Fetch recent messages for chat aggregation (sorted newest first)
          const { data: msgs } = await supabase
            .from('whatsapp_messages')
            .select('chat_id, body, created_at, direction, sender_name, provider')
            .order('created_at', { ascending: false })
            .limit(2000);

          // Filter by active provider, but include NULL provider as fallback for older messages
          const filteredMsgs = (msgs || []).filter((m: any) => {
            if (activeProvider === 'evolution') {
              return m.provider === 'evolution' || (m.provider === null && activePhone && m.chat_id?.includes(activePhone));
            } else {
              return m.provider === 'greenapi' || m.provider === null;
            }
          });

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
        // Get chat history (DB-backed, provider-agnostic)
        // Supports both Green API and Evolution API messages
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

          console.log('[Evolution Send] Using instance:', instanceName, 'URL:', EVOLUTION_API_URL, 'Has key:', !!EVOLUTION_API_KEY);

          if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return res.status(400).json({ success: false, error: 'Evolution API not configured (missing URL or key)' });
          }

          // Evolution API v2 correct endpoint: POST /message/sendText/{instanceName}
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
            console.log('[Evolution API send response]:', JSON.stringify(rawData));

            // Evolution API returns { status: 'success', data: { key: {...} } } or similar
            // Accept any successful response (status 200-299)
            succeeded = r.ok;
            messageId = rawData.key?.id || rawData.data?.key?.id || rawData.id || rawData.key || 'unknown';

            console.log('[Evolution API send check] r.ok:', r.ok, 'succeeded:', succeeded, 'messageId:', messageId);

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
          console.log('[Green API send response]:', JSON.stringify(rawData));

          // Accept any 2xx response OR if idMessage exists
          succeeded = r.ok || !!rawData.idMessage;
          messageId = rawData.idMessage || rawData.key || 'unknown';

          console.log('[Green API send check] r.ok:', r.ok, 'idMessage:', rawData.idMessage, 'succeeded:', succeeded, 'messageId:', messageId);

          if (!succeeded) {
            const errMsg = rawData.message || rawData.error || rawData.description || JSON.stringify(rawData);
            console.error('Green API sendMessage failed:', errMsg, 'chatId:', chatId);
            return res.json({ success: false, error: errMsg, raw: rawData });
          }
        }

        // Persist outgoing message
        let persistenceError = null;
        try {
          console.log('[Persistence] Starting message insert. supabase:', supabase !== null, 'provider:', activeProvider, 'messageId:', messageId, 'chatId:', chatId);

          if (supabase !== null) {
            const insertPayload = {
              provider: activeProvider,
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: message,
              raw: rawData,
              created_at: new Date().toISOString()
            };
            console.log('[Persistence] Insert payload:', JSON.stringify(insertPayload));

            const { data, error } = await supabase.from('whatsapp_messages').insert(insertPayload);
            if (error) {
              console.error('[Persistence] Insert error:', JSON.stringify(error));
              persistenceError = error;
            } else {
              console.log('[Persistence] Insert successful:', JSON.stringify(data));
            }
          } else {
            console.warn('[Persistence] Supabase client is null, skipping database insert');
            persistenceError = 'Supabase client is null';
          }

          await supaDb.createCall({
            type: 'WhatsApp',
            contactPhone: String(chatId || ''),
            duration: 0,
            notes: `Outbound WhatsApp: ${String(message || '').slice(0, 200)}`,
            repId: null,
            timestamp: new Date().toISOString()
          } as any);

          console.log('[Persistence] Message persistence completed successfully');
        } catch (err: any) {
          console.error('[Persistence] Exception during persistence:', err?.message || err);
          persistenceError = err?.message || String(err);
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

      case 'sendAudio': {
        // POST /api/whatsapp?action=sendAudio
        // Send audio files (MP3, OGG, etc.) via Evolution API or Green API
        const { chatId, audioBase64, mimeType } = req.body;
        if (!chatId || !audioBase64) {
          return res.status(400).json({ error: 'chatId, audioBase64 required' });
        }

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');
        let succeeded = false;
        let messageId = 'unknown';
        let rawData: any = {};

        if (activeProvider === 'evolution') {
          // Route to Evolution API
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName) {
            return res.status(400).json({ success: false, error: 'Evolution API not linked' });
          }

          if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return res.status(400).json({ success: false, error: 'Evolution API not configured' });
          }

          console.log('[Evolution SendAudio] Using instance:', instanceName);

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

            rawData = await r.json();
            console.log('[Evolution SendAudio response]:', JSON.stringify(rawData));

            succeeded = r.ok;
            messageId = rawData.key?.id || rawData.id || 'unknown';

            if (!succeeded) {
              const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
              console.error('Evolution SendAudio failed:', errMsg);
              return res.json({ success: false, error: errMsg, raw: rawData });
            }
          } catch (err: any) {
            console.error('Evolution SendAudio error:', err.message);
            return res.json({ success: false, error: err.message });
          }
        } else {
          // Green API doesn't have native audio support, use media endpoint
          return res.json({ success: false, error: 'Audio sending not supported for Green API. Use sendMedia instead.' });
        }

        // Persist audio message
        try {
          if (supabase) {
            await supabase.from('whatsapp_messages').insert({
              provider: activeProvider,
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: '[Audio Message]',
              type: 'audioMessage',
              raw: rawData,
              created_at: new Date().toISOString()
            });
          }
        } catch (err: any) {
          console.error('[SendAudio Persistence] Error:', err.message);
        }

        return res.json({ success: true, messageId, provider: activeProvider });
      }

      case 'sendMedia': {
        // POST /api/whatsapp?action=sendMedia
        // Send images, videos, or documents via Evolution API or Green API
        const { chatId, mediaBase64, mediaType, fileName, caption, mimeType } = req.body;
        if (!chatId || !mediaBase64 || !mediaType || !fileName) {
          return res.status(400).json({ error: 'chatId, mediaBase64, mediaType, fileName required' });
        }

        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');
        let succeeded = false;
        let messageId = 'unknown';
        let rawData: any = {};

        if (activeProvider === 'evolution') {
          // Route to Evolution API
          const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
          if (!instanceName) {
            return res.status(400).json({ success: false, error: 'Evolution API not linked (no instance name)' });
          }

          if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            return res.status(400).json({ success: false, error: 'Evolution API not configured' });
          }

          console.log('[Evolution SendMedia] Using instance:', instanceName, 'mediaType:', mediaType);

          // Determine Evolution mediatype (Image, video, document)
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
            console.log('[Evolution SendMedia response]:', JSON.stringify(rawData));

            succeeded = r.ok;
            messageId = rawData.key?.id || rawData.id || 'unknown';

            if (!succeeded) {
              const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
              console.error('Evolution SendMedia failed:', errMsg);
              return res.json({ success: false, error: errMsg, raw: rawData });
            }
          } catch (err: any) {
            console.error('Evolution SendMedia error:', err.message);
            return res.json({ success: false, error: err.message });
          }
        } else {
          // Route to Green API (use existing sendFileByUpload endpoint)
          const buffer = Buffer.from(mediaBase64, 'base64');
          const { FormData: NodeFormData } = await import('node:buffer') as any;
          const fd = new (globalThis.FormData || NodeFormData)();
          fd.append('chatId', chatId);
          fd.append('caption', caption || '');
          fd.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), fileName);

          try {
            const r = await fetch(`${BASE_URL}/sendFileByUpload/${API_TOKEN}`, { method: 'POST', body: fd as any });
            rawData = await r.json();
            console.log('[Green API SendMedia response]:', JSON.stringify(rawData));

            succeeded = r.ok || !!rawData.idMessage;
            messageId = rawData.idMessage || 'unknown';

            if (!succeeded) {
              const errMsg = rawData.message || rawData.error || JSON.stringify(rawData);
              console.error('Green API SendMedia failed:', errMsg);
              return res.json({ success: false, error: errMsg, raw: rawData });
            }
          } catch (err: any) {
            console.error('Green API SendMedia error:', err.message);
            return res.json({ success: false, error: err.message });
          }
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
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');
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
        const activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');
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
            greenapi: {
              configured: !!INSTANCE_ID && !!API_TOKEN,
              instanceId: INSTANCE_ID ? 'SET' : 'NOT SET',
              token: API_TOKEN ? 'SET' : 'NOT SET'
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
            // Green API actions
            'status', 'settings', 'webhookInfo', 'setWebhook', 'contacts', 'chats', 'messages', 'send', 'receive', 'deleteNotification', 'checkWhatsapp', 'avatar', 'readChat', 'archiveChat', 'sendFile', 'searchMessages', 'searchUnified', 'mediaProxy', 'messageCount',
            // Evolution API actions
            'createInstance', 'getQRCode', 'getInstanceStatus', 'disconnect', 'webhookConfig', 'selectProvider', 'sendMedia', 'sendAudio',
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
