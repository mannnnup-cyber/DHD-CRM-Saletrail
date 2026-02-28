import type { VercelRequest, VercelResponse } from '@vercel/node';

const INSTANCE_ID = '7103533114';
const API_TOKEN = 'e7d1f33adc654f2c8824b962db22cb03d47a8417ddf84c17a2';
const BASE_URL = `https://api.green-api.com/waInstance${INSTANCE_ID}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

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
          body: JSON.stringify({ chatId, count: 50 })
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
        // Receive incoming notifications
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

      case 'webhook': {
        // Receive webhook from Green API
        const body = req.body;
        console.log('WhatsApp Webhook received:', JSON.stringify(body));
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
