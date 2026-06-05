import fetch from 'node-fetch';

const SUPABASE_URL = 'https://uxvowiyrkrfmxecefaqz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dm93aXlya3JmbXhlY2VmYXF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA2NjU4MywiZXhwIjoyMDkwNjQyNTgzfQ.iEGPOtJ1ScJzlq1-lE5KZ5uNNDMqQWH2VDwHZMm286M';
const INSTANCE_NAME = 'dhd-crm-mpvtjyr3-bv4fva';

async function main() {
  try {
    // Try different Evolution API URLs
    const urls = [
      `https://cloud-api.evolution.com/instance/connectionState/${INSTANCE_NAME}`,
      `https://api.evolution.com/instance/connectionState/${INSTANCE_NAME}`,
      `http://localhost:3001/instance/connectionState/${INSTANCE_NAME}`,
      `http://127.0.0.1:3001/instance/connectionState/${INSTANCE_NAME}`
    ];
    
    let phoneNumber = null;
    
    for (const url of urls) {
      try {
        console.log(`\n🔍 Trying: ${url}`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EVOLUTION_API_KEY || ''
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Got response from ${url}`);
          console.log('Response data:', JSON.stringify(data, null, 2));
          
          phoneNumber = data?.instance?.phone || data?.phone || data?.instance?.jid;
          
          if (phoneNumber) {
            console.log('\n📱 Found phone:', phoneNumber);
            
            // Clean it up
            const clean = phoneNumber.replace(/[@s.whatsapp.net]/g, '').trim();
            console.log('📝 Clean phone:', clean);
            
            // Save to database
            console.log('\n💾 Saving to database...');
            const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
              },
              body: JSON.stringify({
                setting_value: clean
              }),
              whereClause: "setting_key=eq.EVOLUTION_PHONE"
            });
            
            console.log(`Update response: ${updateResp.status}`);
            break;
          }
        }
      } catch (e) {
        console.log(`❌ Failed: ${e.message}`);
      }
    }
    
    if (!phoneNumber) {
      console.log('\n❌ Could not retrieve phone number from any Evolution API URL');
      console.log('Please provide your Evolution API URL and try again');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
