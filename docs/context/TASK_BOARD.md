# Task Board — FollOps

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
| Establish multi-agent development framework | AI | Done | Agent role files, work-packet system, context docs |

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

## Security — Stage 1 Containment (2026-09)

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Security + architecture baseline audit | AI | Done | P0s: public service-role key, anon-readable DB, users.ts takeover chain, app_settings secrets, fail-open webhooks, dead cron |
| Step 0 — backups + baseline | AI+Owner | Done | pg_dump trio + REST export + git bundle in the Administrator dhd-backups folder (OUTSIDE repo; contains secrets) |
| Step 1 — Git HEAD secret containment | AI | Done | `6c8b0d7`: `.env.production` untracked, docs sanitized, `.gitignore` hardened |
| Step 2 — env-first secret precedence | AI | Done | `f6857da`: Evolution/BrightBean/Resend/IMAP keys env-to-DB fallback |
| Step 3 — users.ts takeover containment | AI | Done (owner-verified via temp-account live tests 2026-09-06) | `cc39569`: JWT + role enforcement; all unauth probes 401, rep denial 403, manager allow 200, changePassword self-service confirmed live |
| Owner: reconnect YouTube in BrightBean Studio | Owner | Pending | Token expired again 2026-09-04 |
| Steps 4-6 — handler flip + RLS lockdown | AI | Done | `ef1745b`: 9 handlers prefer `SUPABASE_SERVICE_ROLE_KEY`; 2026-09-07: RLS enabled on all 38 public tables, all 29 USING(true) policies dropped (16 tables had RLS fully disabled before). Rollback = dhd-backups/rollback-rls-lockdown-20260907.sql |
| New `SUPABASE_SECRET_KEY` path | AI+Owner | Done | `2933dbd`: all 11 privileged handlers prefer `SUPABASE_SECRET_KEY` with legacy fallback; owner created sb_secret key + added to Vercel + redeployed; smoke suite passed on new deployment |
| **P0 (DEFERRED BY OWNER): disable compromised legacy Supabase service_role key + verify invalidation** | Owner+AI | **Deferred** | Legacy `SUPABASE_SERVICE_ROLE_KEY` (in public git history since `273ea13`) remains ENABLED as fallback. Deferral decision 2026-09-07. When done: owner disables ONLY legacy service_role (not anon/JWT/publishable/sb_secret), then AI runs smoke suite + old-key invalidation probe. Rollback = re-enable key (instant, no redeploy). Supabase credential remediation NOT complete until this lands |
| Steps 7-12 — rotate remaining compromised credentials | Owner+AI | Pending | Evolution, BrightBean, Resend, OpenAI, IMAP/Gmail (verify credential type first). Supabase service-role = the deferred P0 above |
| Step 13 — WC_WEBHOOK_SECRET + delete junk app_settings rows | Owner+AI | Pending | No active Woo webhook today (only disabled Make.com) |
| Step 14 — CRON_SECRET + cron header fix | Owner+AI | Pending | Automation never ran; header check must read Authorization Bearer |
| Step 15 — final probes | AI | Partial | Anon DB reads/writes now blocked (RLS verified); takeover probes 401; re-run full probe set after deferred legacy-key disable + git rewrite |
| Step 16 — git history rewrite (filter-repo) | Owner+AI | Pending | LAST; `273ea13` message contains Evolution key; force-push + re-clone. Old service_role key invalidation MUST precede or accompany this |
| Stage 2 — full API auth redesign, app_settings migration, staging | AI | Pending | Encrypted secret storage decision needed |

## Bugs / Repairs

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Fix pre-existing: WooCommerce REST 403 | Team | Pending | Store rejects stored consumer key |
| Fix pre-existing: Resend outbound (domain verification?) | Owner | Pending | |
| Disable evolution_user DB role | Owner | Pending | Role exists with publicly-known password (was in docker-compose.yml) |
| BrightBean `/accounts/` HTTP 500 | Owner+AI | Pending | Upstream regression, unconfirmed (since 2026-09-07) |
| YouTube BrightBean token expired | Owner | Pending | Reconnect in Studio |
| Automation cron not running | AI | Pending | CRON_SECRET unset + header mismatch |

## Product Development

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| FollOps rebrand (UI/branding only — no tech identifier changes) | AI | Planned | See BRAND.md; branding may become FollOps, but do NOT rename Git repos, DB tables, API routes, env vars, Supabase/Vercel projects |
| WhatsApp provider switching UI | AI | Planned | Allow switching Green API ↔ Evolution in Settings |
| WooCommerce rep/order association | Team | Planned | WC REST API does not expose admin who created order; need custom meta field |
| WooCommerce DHD custom order statuses sync | AI | Planned | DHD statuses not yet mapped; only pending/completed/cancelled synced |
| Full revenue analytics | AI | Planned | Needs Phase 5 rebuild |
| AI-drafted email reply suggestions | AI | Planned | Requires API key wired to compose |
| AI-drafted WhatsApp message suggestions | AI | Planned | Match to pipeline stage |
| Full Coaching Dashboard data integration | AI | Planned | Real coaching metrics and rep performance data |
| Companion app version bump to 1.1.8 | AI | Done | versionCode 2, versionName 1.1.8 in android/app/build.gradle |
| Supabase RLS policies (least-privilege) | Team | Planned | Define least-privilege table policies for production (after P0 key disabled) |
| Facebook Business Verification | Product Owner | Planned | Required for Meta Cloud API WhatsApp migration |

## UX / Brand

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| FollOps visual design system | AI | Planned | Montserrat headings, Inter body/UI; Navy/Opportunity Gold/Intelligence Blue palette |
| "What should I do next?" screen redesign | AI | Planned | Every important screen should answer this question |
| AI advisor behavior (not reporting engine) | AI | Planned | Eventually AI behaves like a senior business advisor |

## Integrations

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| WooCommerce REST 403 fix | Team | Pending | Store rejects stored consumer key |
| Resend outbound email fix | Owner | Pending | Domain verification? |
| BrightBean `/accounts/` HTTP 500 | Owner+AI | Pending | Upstream regression |
| BrightBean YouTube OAuth reconnect | Owner | Pending | Token expired |
| Evolution API webhook signature checks | AI | Pending | Currently fail open |
| WooCommerce webhook secret (`WC_WEBHOOK_SECRET`) | Owner+AI | Pending | No active webhook today |

## Technical Debt

| Task | Owner | Status | Notes |
| --- | --- | --- | --- |
| Git history rewrite (filter-repo) | Owner+AI | Pending | LAST; `273ea13` message contains Evolution key; force-push + re-clone |
| `evolution_user` DB role disable | Owner | Pending | Publicly-known password |
| Webhook signature enforcement | AI | Pending | WooCommerce fail-open; WhatsApp no check |
| Stale copy: `dhd crm sale trail/` directory | Owner | Known | Never work there — repo is the only live codebase |
| AppContext/DataContext refactor | AI | Deferred | Currently works; high risk if touched |

---

## Work Categories Legend

- **Security** — auth, authorization, RLS, credentials, webhooks, user/customer data, privileged operations
- **Bugs/Repairs** — pre-existing failures, regressions, broken integrations
- **Product Development** — new features, workflow enhancements, AI capabilities
- **UX/Brand** — visual design, branding, usability, accessibility
- **Integrations** — external service connections and their fixes
- **Technical Debt** — cleanup, migration, refactoring, infrastructure
