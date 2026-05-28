const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uxvowiyrkrfmxecefaqz.supabase.co';
const supabaseKey = 'sb_publishable_7N54oEBF9ZXeBLoxuSerhA_syZvvN6M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking database schema...\n');

  // Check if new tables exist
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['contact_organizations', 'duplicate_detections']);

  if (error) {
    console.log('❌ Error checking schema:', error.message);
    console.log('\nAlternatively, checking contacts table columns...\n');

    // Check contacts table columns
    const { data: cols, error: colErr } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);

    if (!colErr && cols && cols.length > 0) {
      const contact = cols[0];
      const newColumns = ['contact_type', 'organization_id', 'enrichment_source', 'enrichment_confidence', 'enrichment_timestamp'];
      const hasNewColumns = newColumns.filter(col => col in contact);
      console.log('Contact table columns found:');
      console.log('✓ New enrichment columns:', hasNewColumns.join(', '));
      console.log('✗ Missing columns:', newColumns.filter(col => !hasNewColumns.includes(col)).join(', '));
    }
  } else {
    console.log('✓ Schema check successful!');
    if (data && data.length > 0) {
      console.log('✓ Found new tables:', data.map(t => t.table_name).join(', '));
    } else {
      console.log('✗ New tables not found yet');
    }
  }
}

checkSchema().catch(err => console.error('Error:', err.message));
