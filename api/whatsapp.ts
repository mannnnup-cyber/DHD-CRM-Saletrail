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

  // Check if credentials are configured
  if (!INSTANCE_ID || !API_TOKEN) {
    return res.status(400).json({
      success: false,
      error: 'WhatsApp credentials not configured',
      message: 'Please set GREENAPI_INSTANCE_ID and GREENAPI_TOKEN environment variables in Vercel'
    });
  }

  const action = req.query.action as string;

  try {
    switch (action) {

      case 'status': {
        const r = await fetch(`${BASE_URL}/getStateInstance/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, state: data.stateInstance });
      }

      case 'chats': {
        const r = await fetch(`${BASE_URL}/getChats/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, chats: data });
      }

      case 'messages': {
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
        const { chatId, message } = req.body;
        const r = await fetch(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message })
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'contacts': {
        const r = await fetch(`${BASE_URL}/getContacts/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, contacts: data });
      }

      case 'receive': {
        // Receive incoming notifications (long polling)
        const r = await fetch(`${BASE_URL}/receiveNotification/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, notification: data });
      }

      case 'deleteNotification': {
        const receiptId = req.query.receiptId as string;
        const r = await fetch(`${BASE_URL}/deleteNotification/${API_TOKEN}/${receiptId}`, {
          method: 'DELETE'
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'settings': {
        // Get instance settings
        const r = await fetch(`${BASE_URL}/getSettings/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, settings: data });
      }

      case 'setWebhook': {
        // Set webhook URL
        const webhookUrl = req.query.webhookUrl as string;
        const r = await fetch(`${BASE_URL}/setWebhookUrl/${API_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl })
        });
        const data = await r.json();
        return res.json({ success: true, data });
      }

      case 'webhookInfo': {
        // Get webhook settings
        const r = await fetch(`${BASE_URL}/getWebhookUrl/${API_TOKEN}`);
        const data = await r.json();
        return res.json({ success: true, webhook: data });
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown action. Use: status, chats, messages, send, contacts, receive, settings, setWebhook, webhookInfo' });
    }
  } catch (err: any) {
    console.error('WhatsApp API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
