import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveContact } from './_lib/resolveContact';

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

    try {
      const typeWebhook = body?.typeWebhook;

      // Only store actual messages — ignore state/ack events
      if (typeWebhook === 'incomingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived' || typeWebhook === 'outgoingMessageReceived') {
        const isInbound = typeWebhook === 'incomingMessageReceived';
        const chatId = isInbound
          ? (body.senderData?.chatId || body.senderData?.sender)
          : (body.messageData?.chatId || body.senderData?.chatId);
        const senderName = body.senderData?.senderName || '';
        const messageId = body.idMessage;
        const timestamp = body.timestamp;
        const msgData = body.messageData || {};
        const text =
          msgData.textMessageData?.textMessage ||
          msgData.extendedTextMessageData?.text ||
          msgData.imageMessageData?.caption ||
          msgData.videoMessageData?.caption ||
          msgData.documentMessageData?.caption ||
          (msgData.typeMessage ? `[${msgData.typeMessage}]` : '');
        const msgType = msgData.typeMessage || 'textMessage';

        if (supabase !== null && chatId && messageId) {
          // Idempotency check
          const { data: existing } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('provider_message_id', messageId)
            .limit(1);

          if (!existing || existing.length === 0) {
            // Extract phone from chatId (e.g. "18761234567@c.us" → "18761234567")
            const phone = isInbound ? chatId.replace(/@.*$/, '') : null;
            const contact = isInbound && phone
              ? await resolveContact({ name: senderName || phone, phone, source: 'WHATSAPP' })
              : null;

            const msgAt = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

            const { data: inserted } = await supabase.from('whatsapp_messages').insert({
              provider: 'greenapi',
              provider_message_id: messageId,
              chat_id: chatId,
              sender_name: senderName,
              direction: isInbound ? 'inbound' : 'outbound',
              body: text,
              type: msgType,
              raw: body,
              contact_id: contact?.id ?? null,
              created_at: msgAt
            }).select('id').single();

            // Log to unified interactions table
            if (contact && inserted) {
              await supabase.from('interactions').insert({
                contact_id: contact.id,
                type: 'WHATSAPP',
                direction: isInbound ? 'INBOUND' : 'OUTBOUND',
                content: text.slice(0, 500),
                metadata: { whatsapp_message_id: inserted.id, provider_message_id: messageId, chat_id: chatId },
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

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: ['status', 'settings', 'webhookInfo', 'setWebhook', 'contacts', 'chats', 'messages', 'send', 'receive', 'deleteNotification', 'checkWhatsapp', 'avatar', 'readChat', 'archiveChat', 'sendFile', 'searchMessages', 'mediaProxy', 'messageCount']
        });
    }
  } catch (err: any) {
    console.error('WhatsApp API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
