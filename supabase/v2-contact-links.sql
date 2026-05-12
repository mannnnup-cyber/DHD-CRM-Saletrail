-- ============================================================
-- DHD CRM SalesTrail — Phase 1: Contact Identity Links
-- v2-contact-links.sql
--
-- Adds contact_id FK to every communication and transaction
-- table so all data can be linked to a master Contact record.
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).
-- ============================================================

-- emails
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON emails(contact_id);

-- calls
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);

-- whatsapp_messages
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wa_messages_contact_id ON whatsapp_messages(contact_id);

-- leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);

-- deals
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);

-- quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON quotes(contact_id);

-- invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);

-- ============================================================
-- dismissed_opportunities (for Phase 3 rules engine)
-- Created here so Phase 3 has no schema dependency to run.
-- ============================================================
CREATE TABLE IF NOT EXISTS dismissed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  rule_key VARCHAR(100) NOT NULL,   -- e.g. 'QUOTE_OVERDUE', 'EMAIL_REPLY_LATE'
  source_id UUID,                    -- ID of the triggering email / call / lead
  dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dismissed_opp_contact ON dismissed_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_opp_rule ON dismissed_opportunities(rule_key);

ALTER TABLE dismissed_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON dismissed_opportunities FOR ALL USING (true);

SELECT 'v2-contact-links applied successfully' AS status;
