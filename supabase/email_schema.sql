-- Email storage schema for Supabase
-- Run this in your Supabase SQL Editor

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(500) UNIQUE, -- Email message ID
  thread_id VARCHAR(500), -- Thread ID for email threading
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_email VARCHAR(255),
  subject TEXT,
  body TEXT,
  body_html TEXT,
  date TIMESTAMPTZ,
  read BOOLEAN DEFAULT false,
  starred BOOLEAN DEFAULT false,
  category VARCHAR(50) DEFAULT 'other', -- lead, support, newsletter, other
  lead_score INTEGER DEFAULT 50,
  ai_analysis JSONB, -- { intent, sentiment, urgency, keyPoints, suggestedAction }
  thread_count INTEGER DEFAULT 1,
  is_part_of_thread BOOLEAN DEFAULT false,
  converted_to_lead BOOLEAN DEFAULT false,
  assigned_to VARCHAR(100),
  source VARCHAR(50) DEFAULT 'manual', -- IMAP, Resend, manual
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_lead_score ON emails(lead_score);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_conversion ON emails(converted_to_lead);

-- Lead patterns table (for predictive scoring)
CREATE TABLE IF NOT EXISTS lead_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type VARCHAR(100), -- keyword, phrase, sentiment, timing
  pattern_value TEXT NOT NULL,
  score_boost INTEGER DEFAULT 0, -- positive or negative boost
  conversion_rate DECIMAL(5,2), -- how often this pattern leads to conversion
  sample_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Predefined lead patterns
INSERT INTO lead_patterns (pattern_type, pattern_value, score_boost, conversion_rate, sample_count) VALUES
-- High score indicators
('keyword', 'quote', 15, 75.0, 100),
('keyword', 'pricing', 15, 70.0, 80),
('keyword', 'budget', 15, 85.0, 90),
('keyword', 'cost', 10, 65.0, 70),
('keyword', 'timeline', 10, 60.0, 60),
('keyword', 'deadline', 10, 65.0, 55),
('keyword', 'urgent', 10, 55.0, 50),
('keyword', 'asap', 10, 55.0, 45),
('keyword', 'meeting', 10, 60.0, 65),
('keyword', 'call', 8, 50.0, 80),
('keyword', 'demo', 12, 70.0, 75),
('keyword', 'interested', 12, 68.0, 70),
('keyword', 'purchase', 15, 80.0, 60),
('keyword', 'buy', 15, 75.0, 55),
('keyword', 'contract', 12, 78.0, 40),
('keyword', 'invoice', 8, 55.0, 90),
('keyword', 'proposal', 10, 65.0, 50),
('keyword', 'business', 8, 55.0, 100),
-- Low score indicators
('keyword', 'unsubscribe', -30, 5.0, 30),
('keyword', 'newsletter', -25, 8.0, 200),
('keyword', 'update', -20, 15.0, 150),
('keyword', 'spam', -40, 1.0, 20),
('keyword', 'help', -10, 35.0, 100),
('keyword', 'support', -10, 40.0, 120),
('keyword', 'issue', -8, 38.0, 90),
('keyword', 'problem', -8, 35.0, 85),
('keyword', 'refund', -15, 20.0, 40);

-- Historical conversions table (for learning)
CREATE TABLE IF NOT EXISTS email_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id),
  converted_at TIMESTAMPTZ DEFAULT now(),
  deal_value DECIMAL(10,2),
  deal_stage VARCHAR(100),
  notes TEXT
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject_template TEXT,
  body_template TEXT,
  category VARCHAR(50), -- intro, followup, quote, proposal, closing
  usage_count INTEGER DEFAULT 0,
  avg_response_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Predefined templates
INSERT INTO email_templates (name, subject_template, body_template, category, usage_count) VALUES
('Initial Response', 'Re: {{subject}}', 'Hi {{name}},

Thank you for reaching out to Dirty Hand Designs. We''re excited to learn about your project!

I''d love to schedule a quick call to understand your needs better. Are you available this week?

Best regards,
{{rep_name}}', 'intro', 0),

('Follow Up', 'Following up on your inquiry', 'Hi {{name}},

I wanted to follow up on my previous email. Have you had a chance to review the information?

I''d be happy to answer any questions you might have.

Best,
{{rep_name}}', 'followup', 0),

('Quote Follow Up', 'Quote for {{subject}}', 'Hi {{name}},

Following up on the quote I sent over. Do you have any questions about the pricing or timeline?

Looking forward to hearing from you!

Best,
{{rep_name}}', 'quote', 0),

('Thank You', 'Thank you for your business!', 'Hi {{name}},

Thank you for choosing Dirty Hand Designs. It was a pleasure working with you!

If you ever need our services again, don''t hesitate to reach out.

Best,
{{rep_name}}', 'closing', 0);

-- Email stats view
CREATE OR REPLACE VIEW email_stats AS
SELECT
  date_trunc('day', date) as day,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE read = false) as unread_emails,
  COUNT(*) FILTER (WHERE category = 'lead' AND lead_score >= 80) as hot_leads,
  COUNT(*) FILTER (WHERE category = 'lead' AND lead_score >= 50 AND lead_score < 80) as warm_leads,
  COUNT(*) FILTER (WHERE category = 'lead' AND lead_score < 50) as cold_leads,
  AVG(lead_score) as avg_lead_score,
  COUNT(*) FILTER (WHERE converted_to_lead = true) as conversions
FROM emails
GROUP BY date_trunc('day', date)
ORDER BY day DESC;

-- If source column doesn't exist (for existing tables), add it:
-- ALTER TABLE emails ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Enable Row Level Security (optional, for multi-user)
-- ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own emails" ON emails FOR SELECT USING (true);

-- ============================================
-- APP SETTINGS TABLE (for in-app configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50) DEFAULT 'text', -- text, password, number, boolean, json
  description TEXT,
  category VARCHAR(50) DEFAULT 'general', -- email, integrations, general, api
  is_encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Predefined settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, description, category, is_encrypted) VALUES
-- Email Settings
('IMAP_HOST', '', 'text', 'IMAP server hostname (e.g., imap.gmail.com)', 'email', false),
('IMAP_PORT', '993', 'number', 'IMAP port (default: 993)', 'email', false),
('IMAP_USER', '', 'text', 'Your email address for IMAP', 'email', false),
('IMAP_PASSWORD', '', 'password', 'IMAP password or app password', 'email', true),
('IMAP_USE_TLS', 'true', 'boolean', 'Use TLS/SSL connection', 'email', false),
('RESEND_API_KEY', '', 'password', 'Resend API key for sending emails', 'email', true),
('DEFAULT_FROM_EMAIL', 'sales@saletrail.com', 'text', 'Default sender email address', 'email', false),
('DEFAULT_FROM_NAME', 'DHD Sales', 'text', 'Default sender name', 'email', false),

-- AI Settings
('OPENAI_API_KEY', '', 'password', 'OpenAI API key for AI features', 'api', true),
('AI_ANALYSIS_ENABLED', 'true', 'boolean', 'Enable AI email analysis', 'api', false),
('AI_SUGGESTIONS_ENABLED', 'true', 'boolean', 'Enable AI reply suggestions', 'api', false),

-- Integration Settings
('GREEN_API_ID', '', 'text', 'Green API ID for WhatsApp', 'integrations', false),
('GREEN_API_TOKEN', '', 'password', 'Green API Token', 'integrations', true),
('WOOCOMMERCE_URL', '', 'text', 'WooCommerce store URL', 'integrations', false),
('WOOCOMMERCE_KEY', '', 'password', 'WooCommerce Consumer Key', 'integrations', true),
('WOOCOMMERCE_SECRET', '', 'password', 'WooCommerce Consumer Secret', 'integrations', true),

-- Evolution API Settings (WhatsApp Integration)
('EVOLUTION_INSTANCE_NAME', '', 'text', 'Evolution API instance name for WhatsApp', 'integrations', false),
('EVOLUTION_API_URL', 'http://localhost:3001', 'text', 'Evolution API server URL', 'integrations', false),
('EVOLUTION_API_KEY', '', 'password', 'Evolution API authentication key (optional)', 'integrations', true),
('EVOLUTION_PHONE', '', 'text', 'Linked WhatsApp phone number', 'integrations', false),
('WHATSAPP_ACTIVE_PROVIDER', 'greenapi', 'text', 'Active WhatsApp provider: greenapi or evolution', 'integrations', false)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- WhatsApp Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'greenapi' or 'evolution'
  provider_message_id VARCHAR(500), -- Message ID from the provider
  chat_id VARCHAR(50) NOT NULL, -- WhatsApp phone number or chat ID
  direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
  body TEXT NOT NULL, -- Message content
  raw JSONB, -- Raw response from WhatsApp provider
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_provider ON whatsapp_messages(provider);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);

-- Full-text search index for message content
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_body_fts ON whatsapp_messages
  USING GIN (to_tsvector('english', body));

-- ============================================
-- WhatsApp Chats Table (Chat Metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_chats (
  chat_id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'pending')),
  assigned_to VARCHAR(255) DEFAULT 'Unassigned',
  contact_name VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for chat metadata queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_contact_name ON whatsapp_chats(contact_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_status ON whatsapp_chats(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_assigned_to ON whatsapp_chats(assigned_to);

-- ============================================
-- IMAP SETUP INSTRUCTIONS
-- ============================================
-- To sync emails from your IMAP mailbox, add these environment variables in Vercel:
--
-- IMAP_HOST     : Your IMAP server (e.g., imap.gmail.com)
-- IMAP_PORT     : IMAP port (default: 993)
-- IMAP_USER     : Your email address
-- IMAP_PASSWORD : Your app password (NOT your regular password)
-- IMAP_USE_TLS  : true/false (default: true)
--
-- For Gmail:
-- 1. Enable 2-Factor Authentication
-- 2. Go to https://myaccount.google.com/apppasswords
-- 3. Generate an App Password for "Mail"
-- 4. Use that 16-character password as IMAP_PASSWORD
--
-- For other providers (Outlook, Yahoo, etc.):
-- Use your regular email password or app password as provided by your email service