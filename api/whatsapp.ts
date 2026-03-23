import type { VercelRequest, VercelResponse } from '@vercel/node';

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
        // Get contacts and return as chats (no separate getChats endpoint)
        // Green API doesn't have getChats - we use getContacts and filter
        const r = await fetch(`${BASE_URL}/getContacts/${API_TOKEN}`);
        const contacts = await r.json();

        // Transform contacts to chat format
        const chats = Array.isArray(contacts)
          ? contacts.slice(0, 50).map((c: any) => ({
              id: c.id || c.wid || '',
              name: c.name || c.pushname || c.wid || 'Unknown',
              phone: (c.wid || '').replace('@c.us', '').replace('@s.whatsapp.net', ''),
              lastMessage: '',
              timestamp: '',
              unread: 0,
              status: 'active'
            }))
          : [];

        return res.json({ success: true, chats });
      }

      case 'messages': {
        // Get chat history
        const chatId = req.query.chatId as string;
        const r = await fetch(`${BASE_URL}/getChatHistory/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, count: 100 })
        });
        const data = await r.json();
        return res.json({ success: true, messages: data });
      }

      case 'send': {
        // Send message
        const { chatId, message } = req.body;
        const r = await fetch(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message })
        });
        const data = await r.json();
        return res.json({ success: data.idMessage ? true : false, data, messageId: data.idMessage });
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
