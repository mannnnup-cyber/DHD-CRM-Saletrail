-- ============================================================
-- Companion App Device Info Migration
-- Add android_version + device_brand to devices table.
-- Add rep attribution columns to cellular_calls if missing.
-- Run once in Supabase SQL editor.
-- ============================================================

-- devices: store Android OS version and manufacturer brand separately
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS android_version TEXT,
  ADD COLUMN IF NOT EXISTS device_brand     TEXT;

COMMENT ON COLUMN devices.android_version IS 'Android SDK int as string, e.g. "34" for Android 14';
COMMENT ON COLUMN devices.device_brand IS 'Build.MANUFACTURER, e.g. "samsung", "google"';

-- cellular_calls: rep attribution columns (added via API, document here)
ALTER TABLE cellular_calls
  ADD COLUMN IF NOT EXISTS rep_phone TEXT,
  ADD COLUMN IF NOT EXISTS rep_id    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rep_name  TEXT;

CREATE INDEX IF NOT EXISTS idx_cellular_calls_rep_phone ON cellular_calls(rep_phone);
CREATE INDEX IF NOT EXISTS idx_cellular_calls_rep_id    ON cellular_calls(rep_id);
