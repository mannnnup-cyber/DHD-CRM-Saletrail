import { createClient } from '@supabase/supabase-js';

// Original project from .env.example
const supabaseUrl = 'https://vatsonbvjkyzxqrnderr.supabase.co';
// Need the key - let's try if it's available
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhdHNvbmJ2amt5enhxcm5kZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDAwMjUsImV4cCI6MjA5MDU3NjAyNX0.OEYwJG8Zh0Dp3Fg2ScPRxMvUXtSLkqp0NjwMUKmR9jQ';

console.log('🔍 Checking ORIGINAL database: vatsonbvjkyzxqrnderr\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const tables = ['users', 'contacts', 'leads', 'emails', 'interactions', 'contact_organizations', 'duplicate_detections'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('not found')) {
      console.log(`✗ ${table.padEnd(25)} - NOT FOUND`);
    } else if (error) {
      console.log(`? ${table.padEnd(25)} - Check auth`);
    } else {
      console.log(`✓ ${table.padEnd(25)} - EXISTS`);
    }
  }
}

checkDb().catch(err => console.error('Error:', err.message));
