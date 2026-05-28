import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uxvowiyrkrfmxecefaqz.supabase.co';
const supabaseKey = 'sb_publishable_7N54oEBF9ZXeBLoxuSerhA_syZvvN6M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
  console.log('📊 Querying database for all tables...\n');

  try {
    // Try to query information schema directly
    const { data, error } = await supabase.rpc('get_tables', {});
    
    if (error) {
      console.log('Standard query failed, trying alternative...');
      
      // Try a different approach - just list some known tables
      const tables = ['users', 'contacts', 'leads', 'emails', 'interactions', 'contact_organizations', 'duplicate_detections'];
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        if (error && error.message.includes('not found')) {
          console.log(`✗ ${table} - NOT FOUND`);
        } else if (error) {
          console.log(`? ${table} - Error: ${error.message.substring(0, 50)}`);
        } else {
          console.log(`✓ ${table} - EXISTS`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

listAllTables();
