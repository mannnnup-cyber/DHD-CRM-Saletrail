const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://vatsonbvjkyzxqrnderr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHNvbmJ2amt5enhxcm5kZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTEzMzksImV4cCI6MjA4Nzg4NzMzOX0.Uty-mze63w9ecdE36JLvIM9A0NaPA8FyWqGyMCa944A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  try {
    // Try to insert a test row into cellular_calls to see if table exists
    const { data, error } = await supabase
      .from('cellular_calls')
      .insert({
        phone_number: '+1234567890',
        phone_normalized: '1234567890',
        call_type: 'INCOMING',
        duration_seconds: 0,
        called_at: new Date().toISOString()
      })
      .select();
    
    if (error && error.code === '42P01') {
      console.log('✓ Table does not exist yet - will create it');
      // Table doesn't exist, need to create via SQL
      // For now, just report the need
      console.log('ERROR: Cannot create table via REST API');
      console.log('SOLUTION: Must use Supabase SQL Editor directly');
      process.exit(1);
    } else if (error) {
      console.error('Error:', error);
      process.exit(1);
    } else {
      console.log('✓ Table exists and is working!');
      // Delete our test row
      await supabase.from('cellular_calls').delete().eq('phone_number', '+1234567890');
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

migrate();
