-- Automation rules: defines what to watch and what to do
CREATE TABLE IF NOT EXISTS automation_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  trigger_type   text NOT NULL,   -- whatsapp_unread | no_activity | lead_no_contact | deal_stale | missing_data
  trigger_config jsonb NOT NULL DEFAULT '{}',
  action_type    text NOT NULL DEFAULT 'create_task',
  action_config  jsonb NOT NULL DEFAULT '{}',
  is_active      boolean NOT NULL DEFAULT true,
  cooldown_hours int NOT NULL DEFAULT 24,
  created_at     timestamptz DEFAULT now()
);

-- Automation runs: deduplication log + task audit trail
CREATE TABLE IF NOT EXISTS automation_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
  entity_type text NOT NULL,   -- contact | deal | lead
  entity_id   uuid NOT NULL,
  task_id     uuid,            -- the task created, if any
  status      text NOT NULL DEFAULT 'completed',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_runs_lookup
  ON automation_runs (rule_id, entity_type, entity_id, created_at DESC);

-- Default rules (safe to re-run: ON CONFLICT DO NOTHING requires unique name)
ALTER TABLE automation_rules ADD CONSTRAINT IF NOT EXISTS automation_rules_name_key UNIQUE (name);

INSERT INTO automation_rules (name, trigger_type, trigger_config, action_config, cooldown_hours) VALUES
  (
    'WhatsApp Response SLA',
    'whatsapp_unread',
    '{"hours": 2}',
    '{"title": "Reply to {{name}} on WhatsApp", "priority": "high"}',
    8
  ),
  (
    'No Activity Follow-up',
    'no_activity',
    '{"days": 14}',
    '{"title": "Re-engage {{name}} — no contact in 14 days", "priority": "medium"}',
    168
  ),
  (
    'New Lead First Contact',
    'lead_no_contact',
    '{"hours": 4}',
    '{"title": "First contact: call {{name}}", "priority": "high"}',
    24
  ),
  (
    'Stale Deal Nudge',
    'deal_stale',
    '{"days": 7}',
    '{"title": "Push {{name}} deal forward — stalled {{days}}d", "priority": "medium"}',
    72
  ),
  (
    'Missing Phone Number',
    'missing_data',
    '{"field": "phone"}',
    '{"title": "Add phone number for {{name}}", "priority": "low"}',
    720
  )
ON CONFLICT (name) DO NOTHING;
