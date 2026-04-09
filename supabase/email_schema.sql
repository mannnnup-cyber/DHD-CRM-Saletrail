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