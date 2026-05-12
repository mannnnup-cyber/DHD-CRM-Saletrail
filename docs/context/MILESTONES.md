# Milestones

## Phase 0: AI Workflow Foundation

Status: Done

- Add guard-rail files under `docs/context/`.
- Add root `AGENTS.md`.
- Add file map with Markdown and parseable JSON.
- Add reusable prompt template.
- Install project dependencies.
- Set up GitNexus and Context7.
- Verify build.

## Phase 0b: Core CRM Workflows

Status: Done

- AppContext decomposition into AuthContext, SyncContext, DataContext.
- Quote → Invoice workflow with Approve/Decline/Convert actions.
- Email inbox: IMAP sync, body rendering fix, sort order, deduplication,
  auto-sync, last-synced timestamp.
- Settings persistence via localStorage-first pattern.

## Phase 1: Data Foundation

Status: Planned

The highest priority phase. Enables every feature in Phases 2–6.

- Write and run `supabase/v2-contact-links.sql` — add `contact_id` FK to
  emails, calls, whatsapp_messages, leads, deals, quotes, invoices.
- Build `api/contacts.ts` identity resolution — match by email then phone,
  create Contact if no match.
- Wire email sync, call logging, WhatsApp webhook, WooCommerce sync to write
  `contact_id` and log to `interactions` table.
- Migrate existing leads into `contacts` table with one-time script.

## Phase 2: Unified Customer Profile

Status: Planned

Depends on Phase 1.

- Build `src/pages/ContactProfile.tsx` — 360° view with timeline, orders,
  deals, leads, and action bar.
- Build `src/pages/Contacts.tsx` — master contact list replacing LeadImport.
- Cross-link all pages (Calls, Email, WhatsApp, WooCommerce, Pipeline) to
  Contact Profile by contact name.

## Phase 3: Missed Opportunity Engine

Status: Planned

Depends on Phase 1.

- Write `api/opportunities.ts` implementing 9 rules from the DHD CS manual
  timeframes (2hr quote, 24hr email, 3-day pickup, next-day feedback, etc.).
- Build `src/components/ActionList.tsx` — daily action list widget for Dashboard.
- Replace hardcoded notifications in App.tsx with live opportunity data.

## Phase 4: Smart Lead Import & AI Enrichment

Status: Planned

Depends on Phase 1. Requires Gemini API key.

- AI-powered import analysis using Google Gemini Flash (free tier).
- Duplicate detection against existing contacts before import.
- Optional Tavily web enrichment per contact.
- Priority-sorted import results with suggested first actions.

## Phase 5: Intelligence Dashboard

Status: Planned

Depends on Phases 1–3.

- Rebuild Dashboard and Reports with live Supabase data.
- Customer order pattern analysis (WooCommerce line items).
- Team accountability metrics from real interaction data.
- Management intelligence view: at-risk customers, top customers, trends.

## Phase 6: AI Communication Layer

Status: Planned

Depends on Phases 1–5. Requires Gemini API key and Facebook Business Verification.

- AI-drafted email replies in Email Inbox (Gemini Flash, informed by contact history).
- AI-drafted WhatsApp messages matched to pipeline stage.
- Migrate WhatsApp from Green API to official Meta Cloud API.
- Unified compose from Contact Profile page.
