import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://cst-evolution-api-50ec8417-b27bd029.usecloudstation.com';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const GREEN_API_ID = process.env.GREEN_API_ID;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;

console.log('Local API Server Configuration:');
console.log('- Supabase URL:', SUPABASE_URL);
console.log('- Evolution API URL:', EVOLUTION_API_URL);
console.log('- Has Evolution API Key:', !!EVOLUTION_API_KEY);
console.log('- Has Green API Token:', !!GREEN_API_TOKEN);

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

// Helper to get settings from app_settings table
async function getSetting(key, defaultValue = '') {
  try {
    console.log(`[getSetting] Querying Supabase for key: ${key}`);
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error) {
      console.log(`[getSetting] Supabase error for ${key}:`, error.code, error.message);
      return defaultValue;
    }

    console.log(`[getSetting] Got value for ${key}:`, data?.setting_value || '(empty)');
    return data?.setting_value || defaultValue;
  } catch (error) {
    console.error(`[getSetting] Exception for ${key}:`, error.message);
    console.error(error);
    return defaultValue;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Main API handler
app.post('/api/whatsapp', async (req, res) => {
  const action = req.query.action;
  console.log(`[API] Received action: ${action}`);

  if (action === 'send') {
    const { chatId, message } = req.body;
    console.log(`[send] chatId: ${chatId}, message: ${message.substring(0, 50)}...`);

    try {
      // Get active provider
      let activeProvider = 'greenapi';
      try {
        activeProvider = await getSetting('WHATSAPP_ACTIVE_PROVIDER', 'greenapi');
      } catch (settingError) {
        console.log(`[send] Error getting provider setting, using default:`, settingError.message);
      }
      console.log(`[send] Active provider: ${activeProvider}`);

      let success = false;
      let messageId = 'unknown';
      let rawData = {};

      if (activeProvider === 'evolution') {
        // Evolution API send
        const instanceName = await getSetting('EVOLUTION_INSTANCE_NAME', '');
        console.log(`[send] Evolution instance: ${instanceName}`);

        if (!instanceName) {
          return res.status(400).json({
            success: false,
            error: 'Evolution API not configured - no instance name'
          });
        }

        const evolutionUrl = `${EVOLUTION_API_URL}/message/send`;
        console.log(`[send] Sending to Evolution API: ${evolutionUrl}`);

        const r = await fetch(evolutionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(EVOLUTION_API_KEY && { 'apikey': EVOLUTION_API_KEY })
          },
          body: JSON.stringify({
            instance: instanceName,
            number: chatId,
            text: message
          })
        });

        rawData = await r.json();
        console.log(`[send] Evolution response:`, rawData);

        success = r.ok || !!rawData.key || !!rawData.id;
        messageId = rawData.key || rawData.id || rawData.messageId || 'unknown';
      } else {
        // Green API send
        if (!GREEN_API_ID || !GREEN_API_TOKEN) {
          return res.status(400).json({
            success: false,
            error: 'Green API not configured'
          });
        }

        const greenUrl = `https://api.green-api.com/waInstance/${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
        console.log(`[send] Sending to Green API`);

        const r = await fetch(greenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: chatId,
            message: message
          })
        });

        rawData = await r.json();
        console.log(`[send] Green API response:`, rawData);

        success = r.ok || !!rawData.idMessage;
        messageId = rawData.idMessage || 'unknown';
      }

      // Store message in database
      if (success) {
        try {
          const { error: insertError } = await supabase
            .from('whatsapp_messages')
            .insert([{
              provider: activeProvider,
              provider_message_id: messageId,
              chat_id: chatId,
              direction: 'outbound',
              body: message,
              raw: rawData
            }]);

          if (insertError) {
            console.error(`[send] Database insert error:`, insertError);
          } else {
            console.log(`[send] Message stored in database`);
          }
        } catch (dbError) {
          console.error(`[send] Database error:`, dbError);
        }
      }

      return res.json({
        success: success,
        provider: activeProvider,
        messageId: messageId,
        error: success ? null : 'Send failed'
      });

    } catch (error) {
      console.error(`[send] Error:`, error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Default response for unhandled actions
  res.status(400).json({ error: `Unknown action: ${action}` });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Local API server is running' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Local API Server started on http://localhost:${PORT}`);
  console.log(`📍 Proxy configured in Vite to forward /api requests here`);
  console.log(`🚀 Ready to handle WhatsApp API requests\n`);
});
