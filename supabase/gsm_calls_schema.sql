-- ============================================
-- GSM CELLULAR CALLS TABLE
-- ============================================
-- Stores call logs synced from the Android companion app (DHD-CRM-CallLogSync)
-- Separate from whatsapp_calls which stores WhatsApp VoIP calls

CREATE TABLE IF NOT EXISTS cellular_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL,
    phone_normalized TEXT,                          -- digits only, for matching contacts
    call_type TEXT NOT NULL CHECK (call_type IN ('INCOMING', 'OUTGOING', 'MISSED', 'UNKNOWN')),
    duration_seconds INTEGER DEFAULT 0,
    called_at TIMESTAMPTZ NOT NULL,                 -- when the call happened (from phone)
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    contact_name TEXT,                              -- cached at sync time
    device_model TEXT,                              -- Android device (e.g. "SM-G991B")
    synced_at TIMESTAMPTZ DEFAULT NOW(),            -- when the app pushed this record
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent re-syncing the same call twice
    UNIQUE (phone_normalized, called_at)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cellular_calls_called_at ON cellular_calls(called_at DESC);
CREATE INDEX IF NOT EXISTS idx_cellular_calls_phone ON cellular_calls(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_cellular_calls_contact ON cellular_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_cellular_calls_type ON cellular_calls(call_type);

-- RLS: allow all authenticated access (matches other tables in this project)
ALTER TABLE cellular_calls ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Allow all access' AND tablename = 'cellular_calls'
    ) THEN
        CREATE POLICY "Allow all access" ON cellular_calls FOR ALL USING (true);
    END IF;
END $$;
