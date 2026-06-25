# Milestones

## Phase 0: AI Workflow Foundation

Status: Done

- Guard-rail files created under `docs/context/`.
- Root `AGENTS.md` added.
- File map with Markdown and parseable JSON.
- Reusable prompt template.
- GitNexus and Context7 set up.
- Build verified.

## Phase 0b: Core CRM Workflows

Status: Done

- AppContext decomposed into AuthContext, SyncContext, DataContext.
- Quote → Invoice workflow with Approve/Decline/Convert actions.
- Email inbox: IMAP sync, body rendering fix, sort order, deduplication,
  auto-sync, last-synced timestamp.
- Settings persistence via app_settings Supabase table.

## Phase 1: Data Foundation

Status: Done

- `supabase/v2-contact-links.sql` — added `contact_id` FK to emails, calls,
  whatsapp_messages, leads, deals, quotes, invoices.
- `api/contacts.ts` — identity resolution: match by email then phone, create
  Contact if no match.
- Email sync, call logging, WhatsApp webhook, WooCommerce sync all write
  `contact_id` and log to `interactions` table.
- Existing leads migrated into `contacts` table.

## Phase 2: Unified Customer Profile

Status: Done

- `src/pages/Contacts.tsx` — master contact list with search, source/status
  filters, WhatsApp button, and status badge.
- `src/pages/ContactProfile.tsx` — 360° view with header, activity timeline
  (calls, emails, WhatsApp, notes), WooCommerce orders, open deals, action bar.
- Cross-linking from CallLogs, WhatsApp, Email, WooCommerce to `/contacts/:id`.
- Inline note creation on activity timeline.
- Activity type filter tabs on timeline.
- Organization hierarchy: company grouping, parent-child contact links.
- Enrichment fields: website, contact preference, timezone, LinkedIn URL.
- Duplicate detection on lead import.
- WhatsApp message button on contact list and contact profile.

## Phase 3: Automation Engine

Status: Done

- `automation_rules` and `automation_runs` tables created in Supabase.
- `api/crm.ts` — automation engine with daily cron trigger via Vercel cron.
- 11 pipeline rules covering: new phone leads, new WhatsApp leads,
  WooCommerce order status changes, stale WooCommerce orders, and
  multi-channel follow-up cadence (WhatsApp → Call → Email).
- Smart channel selector reads 7-day outbound activity history.
- Rep assignment via `cellular_calls.rep_id` (last rep who touched the contact).
- Automation section added to Settings page.
- `api/tasks.ts` — serverless endpoint for task CRUD (GET / POST / PATCH).
- `src/pages/Tasks.tsx` — full task management UI: stats, filters, complete
  toggle, add task modal, overdue detection, contact and rep name links.

## Phase 3b: Missed Opportunity Engine

Status: Done

- `api/crm.ts` — action list rules: unanswered emails, WhatsApp unread, no
  activity follow-up, lead no contact, deal stale, missing data.
- `src/components/ActionList.tsx` — daily action list widget surfaced on Dashboard.

## Phase 4: Smart Lead Import & AI Enrichment

Status: Done

- AI enrichment via Anthropic Claude and/or OpenAI (multi-provider).
- Duplicate detection in import flow checks existing contacts before creating.
- Bulk enrichment option on LeadImport page.
- Multi-provider API key validation in Settings (OpenAI and Anthropic).

## Phase 4b: Companion Android App Integration

Status: Done

- Android companion app (DHD-CRM-Companion) syncs GSM calls to Supabase via
  `/api/whatsapp?action=addGSMCall`.
- `cellular_calls` table stores rep_phone, rep_name, contact resolution,
  call type, duration, and timestamps.
- `devices` table registers and tracks active companion devices.
- `src/pages/CompanionApp.tsx` — setup guide, download link, device list,
  version check, and health status.
- `src/components/CompanionConnect.tsx` — compact connection status widget.
- `src/pages/CallLogs.tsx` — full call log with GSM + WhatsApp calls,
  rep filter, date filter (all / last 24h / yesterday / week / month),
  type filter, pagination, and stats.
- `api/whatsapp.ts` — getGSMCalls, getDevices, updateDeviceName,
  addGSMCall, addWhatsAppCall actions.
- GSM calls bridged into `interactions` table for activity timeline.
- Call recording settings placeholder page added.

## Phase 5: Intelligence Dashboard

Status: In Progress

- Team page rebuilt with live Supabase data (calls, WhatsApp, deals per rep).
- Call log stats (total, incoming, outgoing, missed, avg duration, missed rate).
- WhatsApp provider switching: Green API and Evolution API both supported.
- Evolution API integration via Railway-hosted instance.
- Reports page partially rebuilt.

Remaining:
- Full revenue and pipeline analytics from live Supabase data.
- Coaching dashboard data integration.

## Phase 6: AI Communication Layer

Status: Partially Done

- Anthropic Claude API support added to email analysis pipeline.
- Multi-provider AI key management in Settings.

Remaining:
- AI-drafted reply suggestions in Email Inbox.
- AI-drafted WhatsApp message suggestions.
- WhatsApp provider selection UI (plan exists in plan mode draft).
