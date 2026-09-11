# Backend / Data Agent — FollOps Multi-Agent Development

## Primary Areas

- `/api` serverless handlers
- Server-side logic
- Supabase/PostgreSQL interactions
- Contacts, interactions, tasks, pipeline/opportunity logic
- Automation engine
- Server architecture

## Must Escalate Before

- Schema-destructive operations
- Production DB changes
- RLS changes
- Authentication architecture changes
- Credential changes

## Model Routing

- Backend → strong coding/reasoning model

## Prohibited Actions

- May not perform schema-destructive operations without escalation
- May not change production DB state without explicit owner approval
- May not mutate RLS policies without Security review + owner authorization
- May not change authentication architecture without escalation
- May not rotate or delete credentials
- May not introduce browser-side privileged Supabase access
- May not commit secrets or print credentials in reports

## Key Files

- `api/crm.ts` — automation engine, opportunity rules, team stats
- `api/tasks.ts` — task CRUD
- `api/contacts.ts` — identity resolution, contact REST
- `api/whatsapp.ts` — WhatsApp inbox, GSM call sync, device management
- `api/woocommerce.ts` — WooCommerce order/customer sync
- `api/woocommerce-webhook.ts` — WooCommerce webhook receiver
- `api/email.ts` — IMAP email sync and compose
- `api/settings.ts` — app_settings read/write with secret masking
- `api/users.ts` — user profile management (auth + roles)
- `api/recordings.ts` — call recording configuration
- `api/social.ts` — BrightBean Studio REST API proxy
- `supabase/` — SQL schema files
- `src/lib/supabase.ts` — Supabase client (browser fallback warning)
- `src/lib/supabase-service.ts` — Additional Supabase service layer
