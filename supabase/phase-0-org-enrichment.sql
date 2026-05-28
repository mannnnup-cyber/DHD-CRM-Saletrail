-- ============================================
-- PHASE 0: Organization Hierarchy & Enrichment Metadata
-- Smart Contact Enrichment, Duplicate Detection & Organization Hierarchy
-- ============================================

-- ============================================
-- 1. ALTER CONTACTS TABLE - Add organization hierarchy & enrichment columns
-- ============================================
DO $$
BEGIN
    -- Add contact_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'contact_type') THEN
        ALTER TABLE contacts ADD COLUMN contact_type VARCHAR(20) DEFAULT 'individual' CHECK (contact_type IN ('individual', 'organization'));
    END IF;

    -- Add organization_id column (self-reference for hierarchy)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'organization_id') THEN
        ALTER TABLE contacts ADD COLUMN organization_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;

    -- Add role column (position in organization)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'role') THEN
        ALTER TABLE contacts ADD COLUMN role VARCHAR(100);
    END IF;

    -- Add started_at column (when person joined organization)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'started_at') THEN
        ALTER TABLE contacts ADD COLUMN started_at DATE;
    END IF;

    -- Add ended_at column (when person left organization, null = current)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'ended_at') THEN
        ALTER TABLE contacts ADD COLUMN ended_at DATE;
    END IF;

    -- Add is_active column (quick filter for current contacts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'is_active') THEN
        ALTER TABLE contacts ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    -- Add enrichment_source column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'enrichment_source') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_source VARCHAR(100);
    END IF;

    -- Add enrichment_confidence column (0-1 quality score)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'enrichment_confidence') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_confidence FLOAT DEFAULT 0;
    END IF;

    -- Add enrichment_timestamp column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'enrichment_timestamp') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_timestamp TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add enrichment_notes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'enrichment_notes') THEN
        ALTER TABLE contacts ADD COLUMN enrichment_notes TEXT;
    END IF;
END $$;

-- ============================================
-- 2. CREATE INDICES for organization hierarchy lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_is_active ON contacts(is_active);
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_source ON contacts(enrichment_source);

-- ============================================
-- 3. CREATE CONTACT_ORGANIZATIONS TABLE (many-to-many)
-- ============================================
-- Allows handling complex organizational structures:
-- - Schools with multiple principals (one per year)
-- - Companies with departments and multiple managers
-- - Multi-org affiliations
-- ============================================
CREATE TABLE IF NOT EXISTS contact_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role VARCHAR(100),
    started_at DATE,
    ended_at DATE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(contact_id, organization_id, started_at),
    CHECK (contact_id != organization_id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_contact_orgs_contact_id ON contact_organizations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_orgs_org_id ON contact_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_orgs_dates ON contact_organizations(started_at, ended_at);

-- ============================================
-- 4. CREATE DUPLICATE_DETECTIONS TABLE
-- ============================================
-- Tracks suspected duplicate contacts with confidence scoring
-- Supports merge history for audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS duplicate_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_a_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contact_b_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 0,  -- 0-1 match score
    reason VARCHAR(255),         -- 'phone_exact', 'email_exact', 'name_fuzzy_phone', etc.
    merged BOOLEAN DEFAULT false,
    merged_into_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    merged_at TIMESTAMP WITH TIME ZONE,

    CHECK (contact_a_id < contact_b_id)  -- Prevent duplicate records (A,B) and (B,A)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_contacts ON duplicate_detections(contact_a_id, contact_b_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_merged ON duplicate_detections(merged);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_confidence ON duplicate_detections(confidence DESC);

-- ============================================
-- 5. UPDATE INTERACTIONS TABLE - Allow ENRICHMENT type
-- ============================================
-- Modify constraint to add ENRICHMENT to allowed interaction types
-- This allows tracking when contacts are enriched with data
-- ============================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (SELECT constraint_name FROM information_schema.table_constraints
               WHERE table_name = 'interactions' AND constraint_name = 'interactions_type_check') THEN
        ALTER TABLE interactions DROP CONSTRAINT interactions_type_check;
    END IF;

    -- Add new constraint with ENRICHMENT type
    ALTER TABLE interactions ADD CONSTRAINT interactions_type_check
        CHECK (type IN ('WHATSAPP', 'CALL', 'EMAIL', 'NOTE', 'SMS', 'MEETING', 'ENRICHMENT'));
EXCEPTION WHEN OTHERS THEN
    -- Constraint might already exist or have been updated, continue
    NULL;
END $$;

-- ============================================
-- 6. CREATE VIEW for org members (current)
-- ============================================
-- Useful for displaying organization members in UI
CREATE OR REPLACE VIEW org_members_current AS
SELECT
    c.id as member_id,
    c.name as member_name,
    c.email as member_email,
    c.phone as member_phone,
    c.role,
    co.started_at,
    co.ended_at,
    co.is_primary,
    co.organization_id,
    org.name as organization_name
FROM contacts c
JOIN contact_organizations co ON c.id = co.contact_id
JOIN contacts org ON co.organization_id = org.id
WHERE co.ended_at IS NULL  -- Current members only
ORDER BY co.started_at DESC;

-- ============================================
-- 7. CREATE VIEW for org members (all historical)
-- ============================================
-- Useful for displaying organization member history
CREATE OR REPLACE VIEW org_members_all AS
SELECT
    c.id as member_id,
    c.name as member_name,
    c.email as member_email,
    c.phone as member_phone,
    c.role,
    co.started_at,
    co.ended_at,
    CASE WHEN co.ended_at IS NULL THEN 'ACTIVE' ELSE 'ENDED' END as status,
    co.is_primary,
    co.organization_id,
    org.name as organization_name
FROM contacts c
JOIN contact_organizations co ON c.id = co.contact_id
JOIN contacts org ON co.organization_id = org.id
ORDER BY org.name, co.started_at DESC;

-- ============================================
-- 8. CREATE VIEW for enrichment tracking
-- ============================================
-- Shows which contacts have been enriched and from what source
CREATE OR REPLACE VIEW enrichment_status AS
SELECT
    id,
    name,
    email,
    company,
    enrichment_source,
    enrichment_confidence,
    enrichment_timestamp,
    enrichment_notes,
    CASE
        WHEN enrichment_source IS NULL THEN 'NOT_ENRICHED'
        WHEN enrichment_confidence >= 0.9 THEN 'HIGH_CONFIDENCE'
        WHEN enrichment_confidence >= 0.7 THEN 'MEDIUM_CONFIDENCE'
        ELSE 'LOW_CONFIDENCE'
    END as enrichment_quality
FROM contacts
WHERE enrichment_source IS NOT NULL
ORDER BY enrichment_timestamp DESC;

-- ============================================
-- SUMMARY
-- ============================================
-- Phase 0 creates the foundation for smart enrichment:
--
-- 1. Contacts table enhanced with:
--    - Organization hierarchy (contact_type, organization_id, role, date ranges)
--    - Enrichment tracking (source, confidence, timestamp, notes)
--
-- 2. New tables:
--    - contact_organizations: Many-to-many for complex org structures
--    - duplicate_detections: Tracks suspected duplicates with merge history
--
-- 3. Interactions now supports ENRICHMENT type for audit trail
--
-- 4. Helpful views for org members and enrichment status
--
-- Next: Phase 1 implements smart company-based enrichment
-- ============================================

SELECT 'Phase 0: Organization Hierarchy & Enrichment Metadata - Applied Successfully!' as status;
