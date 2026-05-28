# Phase 5 Migration Guide: Critical Contact Fields

## Overview
Phase 5 adds foundational contact fields to support enrichment and lead intelligence. This guide walks you through applying the database migrations.

**Status:** Phase 5.1 Complete (Website URL field)
**Next:** Phase 5.2-5.4 (Contact Preference, Timezone, LinkedIn URL)

---

## Phase 5.1: Website URL Field ✅

### What's Being Added
- `website_url` VARCHAR(500) field on the `contacts` table
- Database indexes for efficient lookups during enrichment
- UI display with clickable link
- Automatic capture during enrichment workflows

### Why It Matters
Website URL is essential for:
- **B2B context:** Company website validates organization legitimacy
- **Enrichment reference:** Used as lookup key in bulk enrichment
- **Lead intelligence:** Distinguishes between individuals and organizations
- **Follow-up:** Direct link to visit company website

### Database Migration Steps

#### Option A: Using Supabase SQL Editor (Recommended)

1. **Open your Supabase Dashboard**
   - Navigate to your DHD-CRM-Saletrail project
   - Click `SQL Editor` in the left sidebar

2. **Create New Query**
   - Click `New Query` button
   - Paste the SQL from below (Option B)

3. **Execute Migration**
   - Click `Run` button
   - Wait for "Success" message
   - Check for any errors

4. **Verify Success**
   ```sql
   -- Run this to verify the column was added
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'contacts' AND column_name = 'website_url';
   ```
   Should return:
   ```
   column_name   | data_type
   website_url   | character varying
   ```

#### Option B: SQL Migration Code

Copy and paste this entire block into your Supabase SQL Editor:

```sql
-- Phase 5.1: Website URL Field Migration
-- Adds website_url to contacts table for enrichment foundation

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'website_url') THEN
    ALTER TABLE contacts ADD COLUMN website_url VARCHAR(500);
    CREATE INDEX idx_contacts_website_url ON contacts(website_url);
    COMMENT ON COLUMN contacts.website_url IS 'Company website URL - captured from enrichment or manual entry';
  END IF;
END $$;

-- Additional index for compound queries during enrichment
CREATE INDEX IF NOT EXISTS idx_contacts_company_website
  ON contacts(company, website_url)
  WHERE website_url IS NOT NULL;
```

### Code Changes Made

#### 1. ContactProfile.tsx (UI Display)
- Added `website_url` to Contact interface
- Displays website with Globe icon in contact header
- Clickable link opens in new tab
- Formats URL for display (strips protocol, trailing slash)

**Before:** Only Email & Phone shown
```
📧 john@example.com | ☎️ +1 876 XXX XXXX
```

**After:** Includes Website
```
📧 john@example.com | ☎️ +1 876 XXX XXXX | 🌐 example.com
```

#### 2. scrape.ts (Single Contact Enrichment)
- Updated `scrapeCompanyWebsite()` to return `website_url`
- Automatically captures the URL being scraped
- Stores in contact record on successful enrichment

#### 3. enrichBulk.ts (Bulk Enrichment)
- Updated `scrapeWebsite()` to return `website_url`
- Captures for each contact in bulk operations
- Included in enriched contact data

### Feature Matrix

| Feature | Status | Details |
|---------|--------|---------|
| Database column | ✅ Complete | website_url VARCHAR(500) |
| Display in UI | ✅ Complete | Globe icon, clickable link |
| Single enrichment | ✅ Complete | Auto-captured in scrape.ts |
| Bulk enrichment | ✅ Complete | Auto-captured in enrichBulk.ts |
| Indexing | ✅ Complete | idx_contacts_website_url created |
| Manual input UI | ⏳ Planned | Coming in Phase 5.2 |

### Testing the Migration

After applying the SQL:

1. **Test Single Contact Enrichment**
   - Open any contact
   - Click "Enrich" button
   - Provide a company website URL
   - After enrichment, should display website URL in header

2. **Test Bulk Enrichment**
   - Navigate to Leads Import
   - Upload CSV with company names
   - Click "Preview Enrichment"
   - Check that website URLs are captured in results

3. **Test UI Display**
   - Open a contact with website_url set
   - Should see Globe icon next to email/phone
   - Click the link → should open website in new tab

---

## Rollback Instructions

If something goes wrong, you can revert the migration:

```sql
-- Rollback Phase 5.1 (use only if needed)
DROP INDEX IF EXISTS idx_contacts_company_website;
DROP INDEX IF EXISTS idx_contacts_website_url;
ALTER TABLE contacts DROP COLUMN IF EXISTS website_url;
```

**Note:** Only rollback if you haven't populated website_url data yet.

---

## Phase 5.2-5.4: Future Fields (Planned)

### Phase 5.2: Contact Preference
```sql
ALTER TABLE contacts 
  ADD COLUMN contact_preference VARCHAR(50) 
    CHECK (contact_preference IN ('email', 'phone', 'whatsapp', 'sms', 'any'));
```
**Purpose:** Skip irrelevant communication channels

### Phase 5.3: Timezone
```sql
ALTER TABLE contacts 
  ADD COLUMN timezone VARCHAR(50);
  -- e.g., 'America/Jamaica', 'America/New_York'
```
**Purpose:** Scheduling calls across regions

### Phase 5.4: LinkedIn URL
```sql
ALTER TABLE contacts 
  ADD COLUMN linkedin_url VARCHAR(500);
```
**Purpose:** B2B context and decision maker verification

---

## Documentation References

- **Full Recommendations:** See `CONTACT_FIELDS_RECOMMENDATIONS.md`
- **Enrichment Architecture:** See `ENRICHMENT_ARCHITECTURE.md` (if available)
- **Database Schema:** `supabase/schema.sql`
- **Migration Files:** `supabase/phase-5-critical-fields.sql`

---

## Support

If you encounter migration issues:

1. **Check Supabase Logs**
   - Dashboard → Settings → Logs tab
   - Look for SQL errors

2. **Verify Permissions**
   - Ensure your Supabase key has admin/DDL permissions
   - Check table ownership

3. **Manual Verification**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'contacts';
   ```

---

## Next Steps

1. ✅ Apply the SQL migration (above)
2. ✅ Test enrichment workflows
3. 📋 Plan Phase 5.2-5.4 implementation
4. 🚀 Deploy to production when ready

