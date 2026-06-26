# Task Board

## Status Values

Use `Planned`, `In Progress`, `Blocked`, `Review`, or `Done`.

---

## AI Workflow Foundation

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Create AI guard-rail docs | AI | Done | `docs/context/` folder |
| Add root AI operating guide | AI | Done | `AGENTS.md` |
| Add parseable file map | AI | Done | Update when routes/APIs/env vars change |
| Set up GitNexus | AI | Done | Re-run `npx gitnexus analyze` after major changes |
| Set up Context7 | AI | Done | Use before changing framework/library usage |
| Verify build | AI | Done | Re-run after code changes |

---

## Phase 1 — Data Foundation

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| `supabase/v2-contact-links.sql` — contact_id FKs | AI | Done | Applied in Supabase |
| `api/contacts.ts` — identity resolution + REST | AI | Done | resolve, list, get, migrate actions |
| Wire email sync to contacts | AI | Done | Sets contact_id, writes to interactions |
| Wire call logging to contacts | AI | Done | addCall resolves phone, logs to interactions |
| Wire WhatsApp webhook to contacts | AI | Done | Inbound resolves phone, logs to interactions |
| Wire WooCommerce sync to contacts | AI | Done | syncOrders resolves customers, updates stats |
| Migrate leads → contacts (one-time) | Team | Done | Completed via POST /api/contacts?action=migrate |

---

## Phase 2 — Unified Customer Profile

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| `src/pages/Contacts.tsx` list page | AI | Done | Replaces LeadImport as master contact list |
| `src/pages/ContactProfile.tsx` 360° view | AI | Done | Timeline, orders, deals, action bar |
| Cross-link all pages to Contact Profile | AI | Done | Calls, Email, WhatsApp, WooCommerce, Pipeline |
| Inline note creation on timeline | AI | Done | Add note directly in activity timeline |
| Activity type filter tabs on timeline | AI | Done | Filter by call, email, WhatsApp, note |
| Organization hierarchy | AI | Done | Company grouping, parent-child links |
| Enrichment fields | AI | Done | Website, contact preference, timezone, LinkedIn |
| Duplicate detection on import | AI | Done | Checks existing contacts before creating |
| WhatsApp button on contact list | AI | Done | Opens WhatsApp inbox pre-loaded for contact |

---

## Phase 3 — Automation Engine

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| `automation_rules` + `automation_runs` tables | AI | Done | Created in Supabase |
| `api/crm.ts` — automation engine | AI | Done | Runs via daily Vercel cron |
| 11 pipeline automation rules | AI | Done | New leads, WC order status, follow-up cadence |
| Smart channel selector | AI | Done | WhatsApp → Call → Email based on 7-day history |
| Rep assignment via cellular_calls | AI | Done | Last rep who called the contact |
| Automation section in Settings page | AI | Done | View/manage rules |
| `api/tasks.ts` — task CRUD endpoint | AI | Done | GET / POST / PATCH; fixes Supabase browser bug |
| `src/pages/Tasks.tsx` — task management UI | AI | Done | Stats, filters, toggle, add, overdue detection |

---

## Phase 3b — Missed Opportunity Engine

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Opportunity rules in `api/crm.ts` | AI | Done | 6 rules: email, WhatsApp, no-activity, stale deal, missing data |
| `src/components/ActionList.tsx` widget | AI | Done | Surfaces daily actions on Dashboard |
| Replace hardcoded notifications in App.tsx | AI | Done | Wired to live opportunity data |

---

## Phase 4 — AI Enrichment & Lead Import

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Multi-provider AI support (OpenAI + Anthropic) | AI | Done | Both APIs validated in Settings |
| Bulk enrichment in LeadImport | AI | Done | Enriches selected contacts in batch |
| Duplicate detection in import flow | AI | Done | Pre-checks before contact creation |

---

## Phase 4b — Companion Android App

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| `cellular_calls` table | AI | Done | Stores all GSM call records with rep info |
| `devices` table | AI | Done | Tracks registered companion devices |
| `addGSMCall` API action | AI | Done | Receives calls from Android app |
| `getGSMCalls` API action | AI | Done | Paginated call log with filters |
| `getDevices` / `updateDeviceName` actions | AI | Done | Device management |
| GSM calls bridged to interactions | AI | Done | Appears on ContactProfile timeline |
| `src/pages/CompanionApp.tsx` | AI | Done | Setup guide, download, device list, health |
| `src/pages/CallLogs.tsx` full rewrite | AI | Done | GSM + WhatsApp, rep/date/type filters, stats |
| Call log rolling 24h "Last 24h" filter | AI | Done | Fixed UTC midnight edge case |
| Yesterday filter added to call log | AI | Done | 48h-24h window |
| Context-aware empty state in call log | AI | Done | Different message for filter vs no data |
| `api/recordings.ts` | AI | Done | Recording settings support |
| `src/pages/RecordingSettings.tsx` | AI | Done | Call recording configuration |
| Call recording end-to-end (companion) | AI | Done | RecordingUploadWorker + PhoneStateReceiver IDLE hook |
| Android version + brand in sync payload | AI | Done | SyncWorker sends Build.MANUFACTURER, SDK_INT; API stores in devices |
| `supabase/companion-device-info.sql` migration | Team | Planned | Run in Supabase: adds android_version, device_brand to devices |

---

## Phase 5 — Intelligence Dashboard

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Team page with live Supabase data | AI | Done | Real calls, WhatsApp, deals per rep |
| Call log stats panel | AI | Done | Incoming/outgoing/missed/avg duration |
| WhatsApp Evolution API integration | AI | Done | Railway-hosted instance |
| Coaching dashboard skeleton | AI | Done | `src/pages/CoachingDashboard.tsx` |
| Reports with live data | AI | In Progress | Partial — pipeline stats live, revenue pending |
| Full revenue analytics | AI | Planned | Needs Phase 5 rebuild |

---

## Phase 6 — AI Communication Layer

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Anthropic Claude in email analysis | AI | Done | Added alongside OpenAI |
| AI reply drafting in Email Inbox | AI | Planned | Requires API key wired to compose |
| AI WhatsApp draft suggestions | AI | Planned | Match to pipeline stage |
| WhatsApp provider switch UI | AI | Planned | Plan drafted; Green API ↔ Evolution API |

---

## Product Backlog

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| WhatsApp provider switching UI | AI | Planned | Allow switching Green API ↔ Evolution in Settings |
| WooCommerce rep/order association | Team | Planned | WC REST API does not expose admin who created order; need custom meta field |
| Supabase RLS policies | Team | Planned | Define least-privilege table policies for production |
| Facebook Business Verification | Product Owner | Planned | Required for Meta Cloud API WhatsApp migration |
| Full Coaching Dashboard data integration | AI | Planned | Real coaching metrics and rep performance data |
| Companion app version bump to 1.1.8 | AI | Done | versionCode 2, versionName 1.1.8 in android/app/build.gradle |
| WooCommerce DHD custom order statuses sync | AI | Planned | DHD statuses not yet mapped; only pending/completed/cancelled synced |
