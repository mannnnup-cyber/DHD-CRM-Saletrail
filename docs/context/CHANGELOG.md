# Changelog

Entries are newest first. Each entry covers a development session or sprint.

---

## 2026-06-25

### Tasks Page Runtime Fix
- Root cause identified: `src/lib/supabase.ts` falls back to `{} as any` in browser builds
  because `require('@supabase/supabase-js')` does not work in Vite's browser bundle.
  All pages that call `supabase.from()` directly were silently failing (DataContext wraps
  with `.catch(() => [])`) or crashing with "Ye.from is not a function".
- Created `api/tasks.ts` — serverless function with GET (list + contact/rep name joins),
  POST (create), and PATCH (update / toggle complete) actions.
- Rewrote `src/pages/Tasks.tsx` data layer to use `fetch('/api/tasks')` consistently with
  all other pages. Removed `supabase` import from Tasks.tsx entirely.

### Call Log 24h Filter Fix
- Changed "Today" filter from UTC midnight to a rolling 24-hour window to eliminate Jamaica
  time-zone edge cases.
- Renamed "Today" button label to "Last 24h" in `src/pages/CallLogs.tsx`.
- Added "Yesterday" filter (48h–24h window).
- Fixed misleading empty state that showed companion app install prompt even when the issue
  was a filter returning zero results.

### WooCommerce Automation Rules
- 11 pipeline automation rules inserted into `automation_rules` table.
- Five new trigger types in `api/crm.ts`: `new_phone_lead`, `new_whatsapp_lead`,
  `woo_order_status`, `woo_stale_order`, `multichannel_followup`.
- Smart channel selector (`getNextChannel`) reads 7-day outbound activity history across
  WhatsApp, calls, and email to decide WhatsApp → Call → Email priority.
- Rep assignment (`findLastRep`) uses `cellular_calls.rep_id` to assign tasks to the rep
  who last called the contact.

---

## 2026-06-24

### Call Logging Improvements
- GSM call interaction logging improved: subject field now shows call type + duration.
- Duration formatting uses minutes:seconds.

### Automation Engine Foundation
- `automation_rules` and `automation_runs` tables created in Supabase.
- `api/crm.ts` automation engine with `fireTask()`, `findLastRep()`, and `getNextChannel()`.
- Vercel cron configured for daily 9am automation run (Hobby tier: once/day max).
- Settings page updated with trigger type labels and automation rule management UI.

### Vercel CI/CD Pipeline
- Migrated CI/CD from broken deploy webhook to Vercel CLI direct deployment.
- Removed automated Vercel deployment from GitHub Actions (reduces duplicate deploys).

---

## 2026-06-25 (earlier)

### WhatsApp Navigation Fix
- WhatsApp navigation refactored from URL query parameters to localStorage
  (`dhd_wa_open_contact`) to preserve chat state across page transitions.

### Contact List WhatsApp Button
- Added WhatsApp message button to contact list row.
- Added Status badge column to contact list desktop view.

### WhatsApp Messaging on Contact Profile
- Added WhatsApp messaging button to ContactProfile action bar.
- Opens WhatsApp page pre-loaded with the contact's conversation.

---

## 2026-06-25 (Anthropic AI Integration)

### Multi-Provider AI Support
- Anthropic Claude API added to email analysis pipeline alongside OpenAI.
- Settings page updated with multi-provider API key input and validation.
- API key validation works for both OpenAI and Anthropic endpoints.

---

## 2026-05-xx to 2026-06-23 (Sprint Summary)

### Companion Android App Integration
- `cellular_calls` table — stores GSM calls synced from Android companion app.
- `devices` table — tracks registered companion devices (phone, name, heartbeat).
- `api/whatsapp.ts` extended: `addGSMCall`, `getGSMCalls`, `getDevices`,
  `updateDeviceName`, `addWhatsAppCall` actions.
- `src/pages/CompanionApp.tsx` — setup guide, QR code/download, device list, version check.
- `src/components/CompanionConnect.tsx` — compact device health widget.
- `src/pages/RecordingSettings.tsx` — call recording configuration.
- `src/pages/CallLogs.tsx` fully rewritten — GSM + WhatsApp call history, rep/date/type
  filters, paginated table, stats bar, empty state variants.
- GSM calls bridged to `interactions` table via `addGSMCall` so they appear on
  ContactProfile activity timeline.

### WhatsApp Evolution API
- Evolution API integration via Railway-hosted instance.
- Webhook support for both Green API and Evolution API formats.
- `api/woocommerce-webhook.ts` — dedicated WooCommerce webhook handler.

### Team Page
- Team page rebuilt with real Supabase data (calls per rep, WhatsApp, deals).
- `api/crm.ts` — team statistics endpoint.
- `api/users.ts` — user profile management.

### Contact Enrichment & Fields
- Additional fields: website URL, contact preference, timezone, LinkedIn URL.
- Organization hierarchy: parent company, company grouping.
- Bulk enrichment in LeadImport.
- Duplicate detection before import.

### Coaching Dashboard
- `src/pages/CoachingDashboard.tsx` — skeleton coaching metrics page.

### Call Forwarding Auto-Poll
- Call forwarding status changed from manual 15-minute wait to auto-poll.

---

## 2026-05-11

### Phase 1: Data Foundation — Complete
- `supabase/v2-contact-links.sql` — adds `contact_id` FK to emails, calls,
  whatsapp_messages, leads, deals, quotes, invoices; creates `dismissed_opportunities`.
- `api/contacts.ts` — identity resolution engine (resolve, list, get, migrate).
- `api/email.ts` — IMAP sync resolves sender to Contact, writes to interactions.
- `api/whatsapp.ts` — inbound webhook resolves phone to Contact, writes to interactions.
- `api/woocommerce.ts` — syncOrders resolves customers, updates contact aggregate stats.
- `src/context/DataContext.tsx` — `addCall` resolves contact phone, writes to interactions.

### Email Inbox Fixes
- `cleanBody()` strips raw MIME boundaries and decodes quoted-printable.
- Sort by date descending (newest first).
- Deduplicate by `messageId`.
- Auto-sync throttled to 30-minute intervals.
- Last-synced timestamp and syncing spinner.

---

## 2026-05-09

### AppContext Decomposition
- Split monolithic `AppContext.tsx` into three focused contexts:
  - `AuthContext.tsx` — demo user list, login, logout.
  - `SyncContext.tsx` — synced calls, Supabase connection flag.
  - `DataContext.tsx` — all CRM state, localStorage, Supabase, mutations.
- `AppContext.tsx` is now a thin shell that stacks the three providers.

### Quote → Invoice Workflow
- `Invoice` type added to `src/data/types.ts`.
- `convertQuoteToInvoice(quoteId)` in DataContext.
- `Invoices.tsx` rebuilt with real invoice state, stats, overdue detection, Mark Paid.
- `Quotes.tsx` updated with Approve, Decline, and Convert to Invoice buttons.

---

## 2026-04-23

- AI orchestration workflow setup.
- Guard-rail docs created under `docs/context/`.
- Root `AGENTS.md` added.
- File map with parseable JSON.
- GitNexus and Context7 documented.
- Build verified.
