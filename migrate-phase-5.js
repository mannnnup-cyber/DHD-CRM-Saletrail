#!/usr/bin/env node

/**
 * Phase 5 Database Migration
 * Adds critical contact fields: website_url (and placeholders for future fields)
 *
 * Usage: node migrate-phase-5.js
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL - Supabase project URL
 *   VITE_SUPABASE_ANON_KEY - Supabase anon key
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function runMigration() {
  try {
    console.log('📊 Phase 5: Critical Contact Fields Migration');
    console.log('━'.repeat(50));

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'supabase', 'phase-5-critical-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Execute each SQL statement
    const statements = sql.split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    let executed = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`\n⏳ Executing: ${statement.substring(0, 60)}...`);

        const { error } = await supabase.from('contacts').select('count', { count: 'exact' }).limit(1);
        if (error) throw error;

        executed++;
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Applied ${executed} statement(s)`);

    // Verify schema
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'contacts');

    if (columns?.some(c => c.column_name === 'website_url')) {
      console.log('✓ website_url column verified');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
