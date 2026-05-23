-- WhatsApp messages storage schema
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) DEFAULT 'greenapi',
  provider_message_id VARCHAR(255) UNIQUE,
  chat_id VARCHAR(255) NOT NULL,          -- e.g. 18761234567@c.us
  sender_name VARCHAR(255),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT,
  type VARCHAR(50) DEFAULT 'text',        -- text, image, document, audio, etc.
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast chat lookups
CREATE INDEX IF NOT EXISTS idx_wa_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_provider_id ON whatsapp_messages(provider_message_id);

-- Enable Supabase real-time on this table
ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;

-- Add table to the real-time publication
-- (run this separately if the publication already exists)
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
