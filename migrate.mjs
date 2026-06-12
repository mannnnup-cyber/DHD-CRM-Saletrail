import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vatsonbvjkyzxqrnderr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHNvbmJ2amt5enhxcm5kZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTEzMzksImV4cCI6MjA4Nzg4NzMzOX0.Uty-mze63w9ecdE36JLvIM9A0NaPA8FyWqGyMCa944A';

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
