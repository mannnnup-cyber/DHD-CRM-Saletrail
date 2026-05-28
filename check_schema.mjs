import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uxvowiyrkrfmxecefaqz.supabase.co';
const supabaseKey = 'sb_publishable_7N54oEBF9ZXeBLoxuSerhA_syZvvN6M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check contacts table and see if new columns exist
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);

    if (contactError) {
      console.log('❌ Error querying contacts:', contactError.message);
      return;
    }

    if (contacts && contacts.length > 0) {
      const contact = contacts[0];
      const newColumns = {
        'contact_type': 'Organization type (individual/organization)',
        'organization_id': 'Link to parent organization',
        'enrichment_source': 'Data source (web_scrape, manual, etc.)',
        'enrichment_confidence': 'Quality score (0-1)',
        'enrichment_timestamp': 'When enrichment happened',
        'enrichment_notes': 'Enrichment details'
      };

      console.log('📊 Contacts Table Status:');
      console.log('─'.repeat(50));
      
      let foundColumns = 0;
      for (const [col, desc] of Object.entries(newColumns)) {
        if (col in contact) {
          console.log(`✓ ${col.padEnd(25)} - ${desc}`);
          foundColumns++;
        } else {
          console.log(`✗ ${col.padEnd(25)} - MISSING`);
        }
      }
      
      console.log(`\nPhase 0 Schema: ${foundColumns}/${Object.keys(newColumns).length} columns found`);
    }

    // Check for new tables
    console.log('\n📋 Checking for new tables...');
    console.log('─'.repeat(50));

    const { data: orgs, error: orgsError } = await supabase
      .from('contact_organizations')
      .select('id')
      .limit(1);

    if (!orgsError) {
      console.log('✓ contact_organizations table exists');
    } else {
      console.log('✗ contact_organizations table NOT found');
    }

    const { data: dupes, error: dupesError } = await supabase
      .from('duplicate_detections')
      .select('id')
      .limit(1);

    if (!dupesError) {
      console.log('✓ duplicate_detections table exists');
    } else {
      console.log('✗ duplicate_detections table NOT found');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkSchema();
