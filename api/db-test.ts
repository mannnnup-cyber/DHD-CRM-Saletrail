import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Check if Supabase credentials are configured
    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({
        success: false,
        connected: false,
        error: 'Supabase credentials not configured',
        message: 'Please set SUPABASE_PROJECT_URL and SUPABASE_ANON_KEY environment variables in Vercel',
        config: {
          urlConfigured: !!supabaseUrl,
          keyConfigured: !!supabaseKey
        }
      });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection by fetching table counts
    const results: any = {};
    const errors: any = {};

    // Test each table
    const tables = ['leads', 'deals', 'calls', 'tasks', 'activities', 'quotes', 'invoices', 'users'];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          errors[table] = error.message;
        } else {
          results[table] = count || 0;
        }
      } catch (e: any) {
        errors[table] = e.message;
      }
    }

    // Overall connection test
    const { error: testError } = await supabase.from('leads').select('id').limit(1);

    return res.json({
      success: !testError,
      connected: !testError,
      error: testError?.message || null,
      message: testError ? 'Connected but some tables may be missing' : 'Database connected successfully',
      tableCounts: results,
      tableErrors: Object.keys(errors).length > 0 ? errors : null,
      config: {
        url: supabaseUrl.replace(/\/rest\/v1\/.*/, '/project/?/settings/api'), // Masked URL
        urlConfigured: true,
        keyConfigured: !!supabaseKey,
        keyPreview: supabaseKey ? `...${supabaseKey.slice(-8)}` : null
      }
    });

  } catch (err: any) {
    console.error('Database test error:', err);
    return res.status(500).json({
      success: false,
      connected: false,
      error: err.message,
      message: 'Failed to connect to database'
    });
  }
}
