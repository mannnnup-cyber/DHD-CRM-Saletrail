# Changelog

## 2026-05-11

### Phase 1: Data Foundation — Complete

- Created `supabase/v2-contact-links.sql` — adds `contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL` to `emails`, `calls`, `whatsapp_messages`, `leads`, `deals`, `quotes`, `invoices`; creates `dismissed_opportunities` table for Phase 3 rules engine. Run in Supabase SQL Editor to apply.
- Created `api/contacts.ts` — identity resolution engine. `resolveContact()` matches by email first, normalised phone second, creates Contact if no match. REST endpoints: `GET /api/contacts` (list), `GET /api/contacts?id=<uuid>` (single + interactions), `POST /api/contacts?action=resolve`, `POST /api/contacts?action=migrate` (one-time leads backfill).
- Updated `api/email.ts` — IMAP sync now resolves sender to Contact on every new email, sets `contact_id`, writes `INBOUND EMAIL` record to `interactions`. `convertToLead` also resolves/creates Contact and links the new lead.
- Updated `api/whatsapp.ts` — inbound webhook resolves sender phone to Contact, sets `contact_id` on the message row, writes `INBOUND WHATSAPP` to `interactions`.
- Updated `api/woocommerce.ts` — new `syncOrders` action resolves each order's customer to Contact, upserts to `woo_orders` with `contact_id`, updates `contacts` aggregate stats (`total_orders`, `total_revenue`, `average_order_value`).
- Updated `src/context/DataContext.tsx` — `addCall` resolves contact phone via `/api/contacts?action=resolve`, passes `contact_id` to Supabase call insert, writes `CALL` record to `interactions`.

**Product owner action required:**
1. Run `supabase/v2-contact-links.sql` in Supabase SQL Editor.
2. Trigger `POST /api/contacts?action=migrate` once to backfill existing leads into contacts.
3. Trigger `POST /api/woocommerce?action=syncOrders` once to seed `woo_orders` and contact stats.

## 2026-05-09

### AppContext Decomposition (Sprint 1)
- Split monolithic `AppContext.tsx` (450 lines) into three focused contexts:
  - `AuthContext.tsx` — demo user list, login, logout. Swap point for Supabase Auth later.
  - `SyncContext.tsx` — synced calls from Google Sheets/MacroDroid, Supabase connection flag, call conversion helpers.
  - `DataContext.tsx` — all CRM state, localStorage persistence, Supabase startup load, all mutations.
- `AppContext.tsx` is now a thin shell (~50 lines) that stacks the three providers and re-exposes the same `useApp()` API. Zero behaviour change — all existing pages work without modification.

### Quote → Invoice Workflow (Sprint 2)
- Added `Invoice` type to `src/data/types.ts` with `Unpaid/Paid/Cancelled` status, `dueDate`, and `paidAt`.
- Added `invoices: Invoice[]` to `AppState`.
- Added `convertQuoteToInvoice(quoteId)` to `DataContext` — atomically approves the quote, creates an invoice with a 14-day due date, and advances the linked deal to `In Production`.
- Added `updateInvoice` and `updateQuote` mutations to `DataContext`.
- Rewrote `Invoices.tsx` — now shows real invoices from state with stats (total, unpaid count, paid revenue, outstanding), overdue detection, and a Mark Paid action.
- Updated `Quotes.tsx` — added Approve, Decline, and Convert to Invoice buttons directly on each quote card, completing the full Quote → Invoice business cycle.

## 2026-05-11

### Customer Intelligence System — Planning & Documentation
- Conducted full codebase and database audit against the new product vision.
- Confirmed that `contacts`, `interactions`, `woo_orders`, `order_trends`, and
  `lead_stages` tables already exist in the schema but are not yet used by the
  application code.
- Analysed DHD Customer Service Manual — extracted enforceable timeframes:
  quote within 2hrs, email within 24hrs, pickup within 3 days, feedback next day.
- Agreed architecture: Contact = master 360° record, Lead = active follow-up
  opportunity linked to a Contact via `contact_id` FK.
- Agreed AI model: Google Gemini Flash free tier (1,500 req/day at no cost).
- Agreed to keep Green API for WhatsApp now; migrate to Meta Cloud API in Phase 6.
- Decided against Chatwoot (separate server/DB works against unified data goal).
- Decided against DeepSeek (customer data privacy risk).
- Created `docs/context/IMPLEMENTATION_PLAN.md` — authoritative 6-phase build
  plan with database changes, new files, env vars, and decisions log.
- Updated `TASK_BOARD.md` with all Phase 1–6 tasks and product owner action items.
- Updated `MILESTONES.md` to reflect the full 6-phase roadmap.

### Email Inbox Fixes (2026-05-11)
- Added `cleanBody()` to strip raw MIME boundaries and decode quoted-printable.
- Sort filteredEmails newest-first by date descending.
- Deduplicate emails by `messageId` to prevent cache + API overlap duplicates.
- Wire `messageId` field through `mapDbEmail` so dedup key is typed correctly.
- Auto-sync on mount throttled to 30-minute intervals via `dhd_last_sync`.
- Show last-synced timestamp and syncing spinner in inbox header.

## 2026-04-23

- Started AI orchestration workflow setup.
- Added dedicated context docs for project brief, architecture, file map,
  commenting standard, task board, milestones, changelog, and prompt template.
- Added root AI operating guide for coding agents.
- Installed project dependencies with npm and generated `package-lock.json`.
- Verified `docs/context/FILE_MAP.md` JSON parses and mapped files exist.
- Verified production build with `npm run build`.
- GitNexus and Context7 execution were blocked by third-party tool execution
  policy and left documented for explicit approval.
