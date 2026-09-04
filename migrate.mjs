import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vatsonbvjkyzxqrnderr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  try {
    console.log('Testing cellular_calls table...');
    const { data, error } = await supabase
      .from('cellular_calls')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('✗ Table does not exist - MIGRATION NEEDED');
      console.log('  Error:', error.message);
      return false;
    } else if (error) {
      console.error('✗ Query error:', error);
      return false;
    } else {
      console.log('✓ cellular_calls table exists and is working!');
      return true;
    }
  } catch (err) {
    console.error('✗ Connection error:', err.message);
    return false;
  }
}

const exists = await migrate();
process.exit(exists ? 0 : 1);
