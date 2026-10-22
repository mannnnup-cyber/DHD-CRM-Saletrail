# Architecture — FollOps

## Runtime Shape

FollOps is a React 19, TypeScript, Vite 7, and Tailwind CSS application
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

## Security Model (Stage 1 Containment — 2026-09, Completed)

- `api/users.ts` enforces server-side auth: privileged actions require a
  Supabase access token (verified via `auth.getUser`) and the caller's role is
  loaded from `user_profiles`. Frontend role claims are never trusted.
  owner/manager required for list/invite/update/remove/resetPassword/
  listDevices/linkDevice; changePassword is self-service via token identity;
  createOwner is public only while zero owners exist. Temporary passwords are
  never returned in responses.
- Secret credentials resolve **env-first, `app_settings` fallback**
  (Evolution key, BrightBean key, Resend key, IMAP credentials). The Evolution
  API *URL* intentionally stays DB-wins (non-secret, Settings-UI managed).
- Frontend sends `Authorization: Bearer <accessToken>` on user-management
  calls via the `src/lib/auth.ts` helper.
- Server privileged credential precedence:
  `SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY` → anon fallback
- **P0 OPEN:** Legacy `SUPABASE_SERVICE_ROLE_KEY` (public git history since
  `273ea13`) remains ENABLED as fallback — owner decision to defer disabling.
  Credential remediation is NOT complete until this lands.
- Webhook signature checks fail open (WooCommerce) or are absent (WhatsApp).

## Frontend

### Email-first Unified Inbox (deployed and verified, 2026-10-15)

`/#/inbox` reads `/api/email?action=inbox` through authenticated fetch calls.
The server verifies a fresh JWT and active canonical profile using modern secret
configuration. Rep access additionally requires an active legacy users row with
the exact Auth UUID and matching verified email; contact ownership is applied
through the persisted email/contact join before pagination. No email/name-based
identity translation is attempted. Owner/manager roles may read the shared store.

Only bounded plaintext fields and verified contact links are returned. The UI
does not render email HTML, load remote images, mark read, sync, send, or invoke AI.
Date/UUID keyset pagination retains database timestamp precision and has an
explicit null-date phase. Store/row UUID identity prevents repeated projection
results; the existing unique message_id constraint is not cross-mailbox evidence.

All legacy email actions now require an active owner/manager and use explicit
mutation methods. Their frontend sends auth headers; browser realtime and local
email cache fallback are removed. New Inbox auth/projection requires the modern
secret; existing unrelated credential compatibility is unchanged. A bounded
warm-process rate limiter provides best-effort protection, not a distributed
quota. No global CSP, RLS policy, migration, credential rotation, or provider
activation is performed by this slice. Deferred credential exposure remains open.

PR #8 fixes native ESM startup by using emitted `.js` helper import specifiers.
A native emitted-handler regression catches resolution failures missed by the
bundler. Production merge 8ce7639 passed hosted synthetic rep assignment and
pagination checks. Auth provisioning automatically creates a legacy users row;
the verification harness removed only its own synthetic mapping to test denial.
UI browser checks used synthetic component data, not a private owner inbox.

### Team account setup (deployed and verified, 2026-10-14)

Invitation/reactivation provisions a passwordless Auth identity and sends a
one-time recovery-type link presented as account setup. Deleted inactive users
are recreated with their historical UUID; returned Auth/link identities must
match. An inactive identity that still exists fails closed for administrator
repair. Pending active setup may resend without changing name or role.
Managers can invite/reactivate reps only, including checks of stored target roles.
New onboarding operations require a request-scoped modern SUPABASE_SECRET_KEY.
Setup delivery intentionally reuses RECOVERY_FROM_EMAIL and RECOVERY_APP_URL,
with the verified FollOps sender and stable public link origin. Delivery failure
reports pending setup and permits retry; no password is generated or emailed.
The existing token-verified completion endpoint remains unchanged. Independent
reviews, 87 tests, hosted UUID compatibility and actual invitation email/setup/login
verification are recorded in completed WP-EMAIL-ONBOARDING. The owner's created
test account remains in place; no existing employee account was removed.

### Password recovery (deployed and verified, 2026-10-13)

The public `/#/recovery` route is outside the CRM auth/data provider and login
gate. Recovery uses `/api/recovery-clear`, not the legacy browser Supabase
client. Custom reset emails contain a generated recovery token hash inside the
URL fragment; the page captures it in memory and removes it from the address
bar. Loading the page does not consume the link. Submitting the password does.

The server creates a fresh anon-key auth client for each request, verifies the
token with OTP type `recovery`, and updates the password with that recovered
user session. Only after that update succeeds may the privileged DB client
clear `must_change_password` for the verified user's active profile. A normal
bearer token or caller-supplied user ID cannot authorize flag cleanup. Recovery
sessions are not persisted or returned to the browser. Cleanup failure after a
password update is reported as partial completion and requires support.
The rewritten recovery endpoint requires `SUPABASE_SECRET_KEY` for profile
access; it does not accept the legacy service-role key. Other handlers' existing
credential compatibility behavior is unchanged.

Production merge `3eea633` passed real recovery-token/password update, replay
rejection, flag cleanup, and new-password login with a temporary normal account.
The delivery follow-up `8661d7b` resolved the owner-reported failure; actual CRM
reset email delivery and the public link were verified. Completed evidence is
in `docs/work-packets/completed/WP-EMAIL-RECOVERY-DELIVERY.md`.
Recovery mail uses `RESEND_API_KEY` env first,
saved-setting fallback, and recovery-only `RECOVERY_FROM_EMAIL` env/settings.
The approved sender is `FollOps <no-reply@pickupja.com>`. Recovery links use
trusted `RECOVERY_APP_URL` or the public CRM origin; generated `VERCEL_URL`
hosts are not used for reset links. Delivery errors remain sanitized.

- Entry point: `src/main.tsx`
- App shell and route table: `src/App.tsx`
- Auth context (real Supabase auth via `/api/users?action=login`, session
  persisted in localStorage `dhd_auth` incl. access token): `src/context/AuthContext.tsx`
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
| `api/users.ts` | User profile management (auth + roles) |
| `api/recordings.ts` | Call recording configuration |
| `api/social.ts` | BrightBean Studio REST API proxy |

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
- Evolution API: self-hosted Docker at `http://76.13.31.176:8080` (server port
  changed from :32768 in Sep 2026). Uses `EVOLUTION_API_URL` and
  `EVOLUTION_API_KEY` (env-first, DB fallback). Instance: `dhd-crm-wa`, linked
  phone 18765202038. Baileys integration: outbound WhatsApp calls NOT
  supported (inbound CALL events only).
- Active send provider controlled by `WHATSAPP_ACTIVE_PROVIDER` app_setting.
- Inbound webhook: `POST /api/whatsapp` (no action param) — auto-detects provider format.

## Social Media Integration

- **BrightBean Studio** (https://studio.brightbean.xyz) — free hosted, open-source
  (AGPL-3.0) social media management platform. CRM proxies its REST API via `api/social.ts`.
- API key resolves from server `BRIGHTBEAN_API_KEY` environment first, then the
  password-masked `app_settings` value. Credentials are request-scoped.
- BrightBean `/accounts/` returned 200 on 2026-10-15; the historical HTTP 500 no
  longer reproduces. YouTube reports a connection error requiring owner review.

## Integrations

| Integration | Purpose | Status |
|------------|---------|--------|
| Supabase | Database, tables, realtime subscriptions | Active — RLS lockdown applied |
| Green API | WhatsApp send/receive (primary) | Active |
| Evolution API | WhatsApp send/receive (secondary, Railway) | Active (Docker) |
| WooCommerce | Order/customer sync | Broken — REST 403 |
| IMAP | Email inbox sync | Gmail app-password update required |
| BrightBean Studio | Social history and draft/reply integration | Accounts 200; historical inbox accessible; fresh inbound unverified; YouTube connection error |
| Vercel | Deployment, serverless API runtime, daily cron | Active |
| Android Companion App | GSM call sync from rep devices | Active |
| GitNexus | Codebase indexing for AI-assisted development | Active |
| Context7 | Up-to-date framework/library docs | Active |
| OpenAI / Anthropic Claude | AI enrichment and email analysis | Active |
| Resend | Outbound email | Recovery/setup sender verified; other global outbound unverified |

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

### BrightBean social Inbox (deployed, 2026-10-15)

PR #10 merged as 4595f07 and production deployment succeeded. All 189 tests,
type-check, build and independent QA/security passed. Hosted startup, anonymous,
normal-rep read/mutation and inactive-account denials passed; temporary test
identity absence was verified. Live owner-browser reads and fresh inbound/reply
delivery remain unverified; available provider history is not proof of freshness.

Unified Inbox adds an owner/manager Social tab with provider list/detail, account
filter and cursor pages, saved drafts, explicit send and discard. Reps are denied
because no verified provider-to-CRM assignment exists. Every social API action,
including existing status/accounts/analytics, verifies a fresh JWT and active
canonical profile using request-scoped SUPABASE_SECRET_KEY clients. Provider keys
resolve env first, saved setting fallback. Requests stay on the configured HTTPS
/api/v1 origin with redirects rejected, bounded responses/inputs and timeouts.
Each operation refreshes provider permissions and workspace/account allowlist;
mutations additionally read the current message/reply and sending checks current
reply eligibility. No browser database calls or database/schema changes.

Only bounded plaintext fields leave the proxy. Attachments, raw metadata, HTML
rendering and tracking images are excluded. Manual refresh replaces polling.
Provider-persisted creation claims reuse an actor/message/request identity and
reject changed payloads. Draft creation never sends. Existing reply send uses the
provider row lock/state protection; it is not an exactly-once platform guarantee.
An uncertain send retains only a reply retry marker in sessionStorage, blocks
edit/discard/send until thread refresh, then requires explicit platform checking
before retry. Uncertain draft creation retains only its request identity; starting
a different draft requires explicit reconciliation/review. Message bodies are not
persisted in browser storage. Provider sent status without a platform receipt is
shown as such, never claimed as confirmed delivery.

Read-only hosted capability checks found usable inbox endpoints and three
allowlisted accounts; the old accounts HTTP 500 no longer reproduces. Available
first-page messages were historical Facebook DMs with expired reply windows.
This does not prove fresh inbound ingestion or real reply delivery. No real
customer draft/send was tested. Gmail mailbox app-password repair remains
separate; this social feature does not repair the collector or reconnect OAuth.


Email import repair (2026-10-16): sync resolves uncached saved settings through the authenticated modern-secret admin, ignores browser settings, requires supported public provider DNS/TLS993 with certificate validation and SNI. Manual imports cap at latest50 and can disable AI per request; the UI skips AI and never auto-imports on mount. Import counts reflect successful email inserts only. Existing contacts match exact email; sync no longer creates contacts automatically. Saved-login validation uses authenticated owner/manager read-only INBOX access without importing messages. Other legacy Settings actions are unchanged.

AI import safety follow-up: omitted skipAi defaults to no analysis, protecting older open browser tabs. AI requires explicit skipAi:false and the saved enabled setting together.
## WhatsApp phone labels and CRM unread — feature branch, 2026-10-21

`feat/whatsapp-labels-unread` adds a compact read-only phone-label catalog and
personal CRM unread state. New actions `phoneLabels` (GET), `inboxUnread` and
`inboxSeen` (POST JSON) dispatch before the legacy WhatsApp handler into
`src/lib/whatsapp/inbox-server.ts`. They require a verified JWT, fresh active
owner/manager profile and modern `SUPABASE_SECRET_KEY` only. Existing legacy
WhatsApp permissions remain a known separate security concern.

Evolution 2.3.7 exposes label definitions but omits chat-label associations from
its chat projection. Accordingly no shared filter/chips, assignment, rename,
merge or deletion is enabled. No provider writes are made by these controls.
Phone color values are displayed as provider codes rather than guessed colors.

The additive, unapplied `20261021172932_whatsapp_inbox_read_state.sql` creates
one service-only RLS table and two security-invoker RPCs. Exact per-actor inbound
message IDs are recorded when a visible open conversation has loaded them.
Arrivals during reading and delayed messages remain unread. This is not phone
read state and sends no WhatsApp read receipts. Stored history begins unread;
badges cap at 99+ while counts remain exact for the first 500 chats loaded by
the existing UI. Missing migration/access shows unavailable, never false zero.
Loaded messages without verified provider receipt status display unknown.

No hosted migration, production deployment or legacy webhook modification has
been performed. Synthetic local SQL validation is not hosted Supabase evidence.

Unread identifier follow-up: production validation found one unsupported stored
identifier causing whole-batch rejection. Feature follow-up filters supported
identifiers before its500 cap, preserves excluded conversations as unknown and
never relaxes server validation or hides chats. New seen requests are also
skipped for unsupported identifiers. No schema/provider changes are involved.

## Shared phone labels — implementation branch, 2026-10-21

The earlier bulk-projection blocker is resolved by a verified existing provider
route: Evolution2.3.7 GET `/chat/findChatByRemoteJid/:instance?remoteJid=...`
returns Chat.labels scoped by instanceId+remoteJid. No provider image, database,
Redis, account connection, registry or Render configuration change is required.
Unshipped Docker research artifacts are excluded from the implementation.

New authenticated `phoneAssignments` reads at most25 conversations with4 workers,
8-second per-call and35-second overall budgets. The server returns only exact
requested JIDs, label IDs and check timestamps; null/missing/malformed/failed
lookups remain unknown. A3-minute bounded cache includes provider origin,
instance, credential fingerprint and JID. Provider work is bounded to120 calls
per minute per warm process; this is not a distributed quota.

UI checks are demand-driven: first25 on opening labels, explicit next25 and
refresh-first25 controls. Inbox30-second polling does not fetch associations.
Expired memberships become unknown; filtering states checked coverage and has a
Not checked option. Names and provider IDs are preserved, duplicate names are
disambiguated, color codes stay in tooltips with neutral dots rather than guessed
colors. Main conversation rows show at most two label chips plus overflow.

`phoneLabelChange` is owner/manager-only and server-gated by exact
`WHATSAPP_LABEL_WRITES_ENABLED=true` (default false). Once separately activated,
explicit selected-chat add/remove uses existing labels, direct phone JIDs,
fresh pre-read and target-state checks, one provider mutation and fresh readback.
No replace-all or automatic mutation retry. Uncertainty blocks UI changes until
explicit refresh/reconciliation. In-flight guards/cache/rate limits are per
process, not cross-process atomicity or exactly-once guarantees. The provider
has no cross-channel compare-and-swap, so concurrent edits to the same label
remain a platform limitation; unrelated labels are preserved by individual ops.

## Inbox usability follow-up (2026-10-22)
Desktop sidebar collapse is persisted as a layout preference, mobile drawer unchanged. Removed legacy provider unread sidebar polling to avoid confusing personal CRM receipts. Unified Inbox refresh resets to newest page; owner/manager explicit Sync latest emails calls existing authenticated AI-free latest50 import. No background mailbox collector is configured. New contacts editIdentity action independently verifies fresh Auth/profile and modern secret, restricts identity corrections to active owners/managers, validates and rejects existing identifier collisions. Collision preflight is best effort without unique identifier constraints; concurrent duplicates remain possible. No external customer account or historical message rewrite. Existing legacy contact endpoints retain their prior limitations.
