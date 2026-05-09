import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle webhook POST from Green API (no action query param)
  if (req.method === 'POST' && !req.query.action) {
    const body = req.body;
    console.log('WhatsApp Webhook received:', JSON.stringify(body));

    // Try to persist inbound message(s) to Supabase if available
    try {
      // Green API may send different shapes; attempt to normalize
      const events = Array.isArray(body) ? body : [body];
      for (const ev of events) {
        // Common payload locations for message data
        const message = ev?.message || ev?.body || ev?.data || ev;
        const providerMessageId = message?.idMessage || message?.id || message?.receiptId || null;
        const from = message?.senderData?.sender || message?.from || message?.chatId || (ev?.sender?.id || null);
        const text = message?.textMessage || message?.body || message?.message || '';
        const timestamp = message?.timestamp || Math.floor(Date.now() / 1000);

        // Idempotency: check whatsapp_messages table for provider_message_id
        if (supabase !== null) {
          try {
            const exists = await supabase.from('whatsapp_messages').select('id').eq('provider_message_id', providerMessageId).limit(1);
            if ((exists && (exists as any).data && (exists as any).data.length > 0) || !providerMessageId) {
              // Already recorded or no provider id — still safe to continue
              continue;
            }

            const insert = {
              provider: 'greenapi',
              provider_message_id: providerMessageId,
              chat_id: from,
              direction: 'inbound',
              body: text,
              raw: ev,
              created_at: new Date(timestamp * 1000).toISOString()
            };

            await supabase.from('whatsapp_messages').insert(insert);

            // Also create a call/activity row for UI timeline
            await supaDb.createCall({
              type: 'WhatsApp',
              contactName: '',
              contactPhone: String(from || ''),
              duration: 0,
              notes: `Inbound WhatsApp: ${String(text || '').slice(0, 200)}`,
              repId: null,
              timestamp: new Date(timestamp * 1000).toISOString()
            } as any);
          } catch (err) {
            console.error('Failed to persist whatsapp webhook event:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error processing webhook:', err);
    }

    // Acknowledge receipt
    return res.status(200).json({ success: true, received: true });
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
              body: JSON.stringify({ chatId, count: 30 })
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
                text: msg.textMessage || msg.text || msg.caption || 'Media message',
                timestamp: msg.timestamp
                  ? new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '',
                fromMe: msg.fromMe === true || msg.type === 'outgoing',
                status: 'read',
                type: msg.typeMessage || msg.type || 'text'
              })).reverse();
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
            const formatted = (msgs || []).map((m: any) => ({
              id: m.provider_message_id || m.id,
              text: m.body || '',
              timestamp: m.created_at,
              fromMe: m.direction === 'outbound',
              status: 'read',
              type: m.type || 'text',
              raw: m.raw || null
            }));
            return res.json({ success: true, messages: formatted, source: 'db' });
          } catch (err) {
            console.error('messagesFromDb error', err);
            // fallback to provider
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

      case 'send': {
        const { chatId, message } = req.body;
        if (!chatId || !message) {
          return res.status(400).json({ success: false, error: 'chatId and message are required' });
        }

        const r = await fetch(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message })
        });
        const data = await r.json();

        const succeeded = !!data.idMessage;

        if (!succeeded) {
          // Surface the actual Green API error so the frontend can show it
          const errMsg = data.message || data.error || data.description || JSON.stringify(data);
          console.error('Green API sendMessage failed:', errMsg, 'chatId:', chatId);
          return res.json({ success: false, error: errMsg, raw: data });
        }

        // Persist outgoing message
        try {
          if (supabase !== null) {
            await supabase.from('whatsapp_messages').insert({
              provider: 'greenapi',
              provider_message_id: data.idMessage,
              chat_id: chatId,
              direction: 'outbound',
              body: message,
              raw: data,
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

        return res.json({ success: true, messageId: data.idMessage });
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

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: ['status', 'settings', 'webhookInfo', 'setWebhook', 'contacts', 'chats', 'messages', 'send', 'receive', 'deleteNotification', 'checkWhatsapp']
        });
    }
  } catch (err: any) {
    console.error('WhatsApp API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
