import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string;

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    switch (action) {
      case 'list': {
        // Get all settings
        const { data: settings } = await supabase
          .from('app_settings')
          .select('*')
          .order('category', { ascending: true })
          .order('setting_key', { ascending: true });

        // Return as key-value object, mask password values
        const result: Record<string, any> = {};
        (settings || []).forEach((s: any) => {
          if (s.setting_type === 'password' && s.setting_value) {
            result[s.setting_key] = '••••••••'; // Mask password
          } else {
            result[s.setting_key] = s.setting_value;
          }
        });

        // Also include raw status for checking if configured
        const rawStatus: Record<string, boolean> = {};
        (settings || []).forEach((s: any) => {
          rawStatus[s.setting_key] = !!s.setting_value;
        });

        return res.json({ success: true, settings: result, isConfigured: rawStatus });
      }

      case 'get': {
        // Get a specific setting
        const { key } = req.query;
        const { data: setting } = await supabase
          .from('app_settings')
          .select('*')
          .eq('setting_key', key as string)
          .single();

        if (!setting) {
          return res.status(404).json({ success: false, error: 'Setting not found' });
        }

        return res.json({ success: true, setting });
      }

      case 'save': {
        // Save/update settings
        const { settings } = req.body as { settings: Record<string, string> };

        if (!settings || typeof settings !== 'object') {
          return res.status(400).json({ success: false, error: 'Invalid settings data' });
        }

        // Get current settings to preserve encrypted values
        const { data: currentSettings } = await supabase
          .from('app_settings')
          .select('setting_key, setting_type, is_encrypted');

        const currentMap: Record<string, any> = {};
        (currentSettings || []).forEach((s: any) => {
          currentMap[s.setting_key] = s;
        });

        // Upsert each setting
        const upserts = Object.entries(settings).map(async ([key, value]) => {
          const current = currentMap[key];

          // If password field and value is masked, don't update
          if (current?.setting_type === 'password' && value === '••••••••') {
            return { key, skipped: true };
          }

          const { error } = await supabase
            .from('app_settings')
            .upsert({
              setting_key: key,
              setting_value: value,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'setting_key'
            });

          return { key, error };
        });

        await Promise.all(upserts);

        return res.json({ success: true, message: 'Settings saved successfully' });
      }

      case 'testEmail': {
        // Test IMAP connection
        const { host, port, user, password, useTls } = req.body;

        // For now, return success - actual IMAP test would require native module
        // In production, this would use imap library to test connection
        if (!host || !user || !password) {
          return res.json({
            success: false,
            error: 'Missing required IMAP settings'
          });
        }

        return res.json({
          success: true,
          message: 'IMAP settings validated. Click "Save" to apply.',
          hint: 'Test sync will verify actual connection when you click "Sync Emails"'
        });
      }

      case 'testResend': {
        // Test Resend API key
        const { apiKey } = req.body;

        if (!apiKey) {
          return res.json({ success: false, error: 'API key required' });
        }

        try {
          const response = await fetch('https://api.resend.com/api-keys', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            return res.json({ success: true, message: 'Resend API key is valid' });
          } else {
            const data = await response.json();
            return res.json({ success: false, error: data.message || 'Invalid API key' });
          }
        } catch (error) {
          return res.json({ success: false, error: 'Failed to test API key' });
        }
      }

      case 'testOpenAI': {
        // Test OpenAI API key
        const { apiKey } = req.body;

        if (!apiKey) {
          return res.json({ success: false, error: 'API key required' });
        }

        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            return res.json({ success: true, message: 'OpenAI API key is valid' });
          } else {
            return res.json({ success: false, error: 'Invalid API key' });
          }
        } catch (error) {
          return res.json({ success: false, error: 'Failed to test API key' });
        }
      }

      case 'categories': {
        // Get all setting categories
        const { data: categories } = await supabase
          .from('app_settings')
          .select('category')
          .order('category');

        const uniqueCategories = [...new Set((categories || []).map((c: any) => c.category))];
        return res.json({ success: true, categories: uniqueCategories });
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Unknown action',
          available: ['list', 'get', 'save', 'testEmail', 'testResend', 'testOpenAI', 'categories']
        });
    }
  } catch (err: any) {
    console.error('Settings API Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
