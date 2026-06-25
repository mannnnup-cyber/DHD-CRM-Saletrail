# Architecture

## Runtime Shape

DHD CRM SalesTrail is a React 19, TypeScript, Vite 7, and Tailwind CSS application
deployed as a Vercel-compatible frontend with serverless API handlers under `api/`.
The app uses hash-based routing through `react-router-dom`. Route definitions live
in `src/App.tsx`. Navigation labels and role filtering live in `src/components/Sidebar.tsx`.

## Critical Architectural Rule: No Direct Supabase in Page Components

The browser Supabase client in `src/lib/supabase.ts` uses a `require()` that does not
work in Vite's browser bundle. The client falls back to `{} as any` silently when
env vars are missing or the require fails. Calling `supabase.from()` from a page
component will throw a runtime error (e.g., "Ye.from is not a function").

**The rule:** All Supabase queries from page components must go through `/api/*`
fetch calls. `DataContext.tsx` is the exception — it wraps every Supabase call with
`.catch(() => [])`, so failures are silent but non-crashing.

## Frontend

- Entry point: `src/main.tsx`
- App shell and route table: `src/App.tsx`
- Auth context (demo login): `src/context/AuthContext.tsx`
- Sync context (companion app calls): `src/context/SyncContext.tsx`
- Data context (CRM state, mutations): `src/context/DataContext.tsx`
- Thin AppContext shell (backward compat): `src/context/AppContext.tsx`
- Reusable components: `src/components/`
- Pages: `src/pages/`
- Static domain data and TypeScript types: `src/data/`
- Utilities: `src/utils/`
- Global styles: `src/index.css`

## State And Data Flow

- `AppProvider` stacks `AuthContext`, `SyncContext`, and `DataContext`.
- All pages consume state via `useApp()` from `src/context/AppContext.tsx`.
- `DataContext` owns CRM state: contacts, leads, deals, quotes, invoices, calls, tasks.
- `DataContext` loads from Supabase on startup (with `.catch(() => [])` fallbacks) and
  persists state to `localStorage` as a backup.
- `localStorage` keys: `dhd_salestrail_state`, `dhd_synced_calls`.
- WhatsApp contact pre-load: `localStorage` key `dhd_wa_open_contact` (set by contacts
  page, read by WhatsApp page to open the correct conversation).

## Backend And APIs

- Vercel serverless API handlers: `api/` (Node.js, TypeScript).
- Each API file creates its own Supabase client directly with `createClient()` using
  `process.env` — these work correctly in serverless.
- SQL schema files: `supabase/`

### API Files
| File | Responsibility |
|------|----------------|
| `api/crm.ts` | Automation engine, opportunity rules, team stats |
| `api/tasks.ts` | Task CRUD (GET / POST / PATCH) |
| `api/contacts.ts` | Identity resolution, contact REST |
| `api/whatsapp.ts` | WhatsApp inbox, GSM call sync, device management |
| `api/woocommerce.ts` | WooCommerce order/customer sync |
| `api/woocommerce-webhook.ts` | WooCommerce webhook receiver |
| `api/email.ts` | IMAP email sync and compose |
| `api/settings.ts` | app_settings read/write with secret masking |
| `api/users.ts` | User profile management |
| `api/recordings.ts` | Call recording configuration |

## Automation Engine

- `api/crm.ts` includes a `runAutomation` handler triggered daily at 9am via
  Vercel cron (defined in `vercel.json`).
- Rules are stored in the `automation_rules` Supabase table (11 active pipeline rules).
- Each run logs to `automation_runs` — checked to avoid duplicate tasks for the same entity.
- `fireTask()` creates a row in the `tasks` table with contact_id, assigned_to, priority, due_date.
- `findLastRep()` assigns tasks to the rep who most recently called the contact.
- `getNextChannel()` selects WhatsApp, Call, or Email based on 7-day outbound activity.

## Companion Android App

- A separate Android app (DHD-CRM-Companion) syncs GSM calls to Supabase via
  `POST /api/whatsapp?action=addGSMCall`.
- Registered devices are tracked in the `devices` table (phone_number, device_name,
  last_heartbeat).
- Call records land in `cellular_calls` (rep_phone, rep_name, rep_id, call_type,
  duration, contact resolution).
- `cellular_calls.rep_phone` and `devices.phone_number` must stay in the same
  format (10-digit, no country code) for the call log rep filter to match.
- GSM calls are also written to `interactions` for the contact activity timeline.

## WhatsApp Integration

- Two providers supported for outbound messaging: **Green API** and **Evolution API**.
- Both providers can receive inbound messages via webhook (format auto-detected).
- Green API: uses env vars `GREENAPI_INSTANCE_ID` and `GREENAPI_TOKEN`.
- Evolution API: hosted on Railway. Uses `EVOLUTION_API_URL` and optional `EVOLUTION_API_KEY`.
- Active send provider controlled by `WHATSAPP_ACTIVE_PROVIDER` app_setting.
- Inbound webhook: `POST /api/whatsapp` (no action param) — auto-detects provider format.

## Integrations

| Integration | Purpose |
|------------|---------|
| Supabase | Database, tables, realtime subscriptions |
| Green API | WhatsApp send/receive (primary) |
| Evolution API | WhatsApp send/receive (secondary, Railway) |
| WooCommerce | Order/customer sync |
| IMAP | Email inbox sync |
| Vercel | Deployment, serverless API runtime, daily cron |
| Android Companion App | GSM call sync from rep devices |
| GitNexus | Codebase indexing for AI-assisted development |
| Context7 | Up-to-date framework/library docs |
| OpenAI / Anthropic Claude | AI enrichment and email analysis |

## Environment Variables

Client-side variables use the `VITE_` prefix and are embedded in the browser build.
Server-side variables are read from `process.env` in `api/` handlers only.
Never document real secrets. See `.env.example` for the full list of key names.

## Database Schema Summary

| Table | Purpose |
|-------|---------|
| `contacts` | Master customer record |
| `interactions` | Unified activity log (all types) |
| `cellular_calls` | GSM calls from companion app |
| `devices` | Registered companion devices |
| `whatsapp_messages` | WhatsApp conversation messages |
| `woo_orders` | WooCommerce order snapshot |
| `tasks` | CRM tasks and follow-ups |
| `automation_rules` | Pipeline rule definitions |
| `automation_runs` | Automation execution log |
| `app_settings` | Persistent configuration (secrets masked) |
| `user_profiles` | CRM user profiles for rep assignment |

## Risk Areas

- `src/context/DataContext.tsx` — all CRM mutations, localStorage, Supabase startup.
- `src/App.tsx` — route table, auth gate, layout shell.
- `src/components/Sidebar.tsx` — navigation, role filtering.
- `api/whatsapp.ts` — GSM call sync AND WhatsApp messaging AND companion app heartbeat.
  Changes here can break the Android app silently.
- `api/crm.ts` — automation engine runs daily; bugs create duplicate or incorrect tasks.
- `supabase/` — schema changes must be checked against all API handlers and frontend types.

## AI Workflow Rule

AI agents must not code from a blank prompt. Each implementation task must start by
reading the context docs, checking the file map, identifying the blast radius via
GitNexus impact analysis, verifying current library usage through Context7 or official
docs when needed, making the smallest safe change, then updating `docs/context/`.
