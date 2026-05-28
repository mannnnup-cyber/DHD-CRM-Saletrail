-- Phase 5: Critical Contact Fields
-- Priority 1 migrations: Foundation for enrichment system and B2B context

-- ============================================
-- 1. WEBSITE URL FIELD
-- ============================================
-- Essential for enrichment reference and B2B context
-- Used as lookup key in enrichment workflows

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'contacts' AND column_name = 'website_url') THEN
    ALTER TABLE contacts ADD COLUMN website_url VARCHAR(500);
    CREATE INDEX idx_contacts_website_url ON contacts(website_url);
    COMMENT ON COLUMN contacts.website_url IS 'Company website URL - captured from enrichment or manual entry';
  END IF;
END $$;

-- ============================================
-- 2. CONTACT PREFERENCE (PLANNED)
-- ============================================
-- Skip irrelevant communication channels
-- Will add: contact_preference VARCHAR(50) CHECK (IN 'email', 'phone', 'whatsapp', 'sms', 'any')

-- ============================================
-- 3. TIMEZONE (PLANNED)
-- ============================================
-- Scheduling calls across regions
-- Will add: timezone VARCHAR(50) (e.g., 'America/Jamaica', 'America/New_York')

-- ============================================
-- 4. LINKEDIN URL (PLANNED)
-- ============================================
-- B2B context and decision maker verification
-- Will add: linkedin_url VARCHAR(500)

-- ============================================
-- INDEXES
-- ============================================
-- Additional index for compound queries during enrichment
CREATE INDEX IF NOT EXISTS idx_contacts_company_website
  ON contacts(company, website_url)
  WHERE website_url IS NOT NULL;
