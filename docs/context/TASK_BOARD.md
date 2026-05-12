# Task Board

## Workflow Setup

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Create AI guard-rail docs | AI agent | Done | None | Keep docs current as work changes |
| Add root AI operating guide | AI agent | Done | None | Keep `AGENTS.md` aligned with context docs |
| Add parseable file map | AI agent | Done | None | Update when files, routes, APIs, or env vars change |
| Install app dependencies | AI agent | Done | None | Review npm audit output separately |
| Set up GitNexus | AI agent | Done | None | Re-run `npx gitnexus analyze` after major changes |
| Set up Context7 | AI agent | Done | None | Use before changing framework/library usage |
| Verify build | AI agent | Done | None | Re-run after future code changes |
| AppContext decomposition | AI agent | Done | None | AuthContext, SyncContext, DataContext created; AppContext is now a thin shell |
| Quote → Invoice workflow | AI agent | Done | None | Approve/Decline on quotes; Convert to Invoice wires quote to invoice and advances deal stage |
| Email inbox fixes | AI agent | Done | None | Body rendering, sort order, deduplication, auto-sync, last-synced timestamp all fixed |

## Phase 1 — Data Foundation

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Write `supabase/v2-contact-links.sql` | AI agent | Planned | None | Add FK columns linking calls/emails/whatsapp/leads/deals/quotes/invoices to contacts |
| Write `api/contacts.ts` (resolve + list + get) | AI agent | Planned | None | Identity resolution is the core function — match by email then phone, create if no match |
| Wire email sync to identity resolution | AI agent | Planned | Phase 1 contacts API | Update `api/email.ts` sync handler to set contact_id and write to interactions |
| Wire call logging to identity resolution | AI agent | Planned | Phase 1 contacts API | Update DataContext and call log to set contact_id and write to interactions |
| Wire WhatsApp webhook to identity resolution | AI agent | Planned | Phase 1 contacts API | Update `api/whatsapp.ts` webhook handler |
| Wire WooCommerce sync to identity resolution | AI agent | Planned | Phase 1 contacts API | Update `api/woocommerce.ts` to set contact_id and update contact order stats |
| Write leads → contacts migration | AI agent | Planned | Phase 1 contacts API | One-time migration: resolve each lead into a contact, set leads.contact_id |

## Phase 2 — Unified Customer Profile

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Build `src/pages/ContactProfile.tsx` | AI agent | Planned | Phase 1 complete | 360° view: header, timeline, orders, deals, open leads, action bar |
| Build `src/pages/Contacts.tsx` list page | AI agent | Planned | Phase 1 complete | Replaces/aliases LeadImport; filters by segment/source/rep |
| Cross-link all pages to Contact Profile | AI agent | Planned | Phase 2 profile page | Calls, Email, WhatsApp, WooCommerce, Pipeline all link to /contacts/:id |

## Phase 3 — Missed Opportunity Engine

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Write `supabase/v3-opportunities.sql` | AI agent | Planned | Phase 1 complete | dismissed_opportunities table |
| Write `api/opportunities.ts` rules engine | AI agent | Planned | Phase 1 complete | 9 rules from CS manual timeframes, scan + dismiss + complete actions |
| Build `src/components/ActionList.tsx` widget | AI agent | Planned | Phase 3 API | Daily action list with one-click actions, shown top of Dashboard |
| Replace hardcoded notifications | AI agent | Planned | Phase 3 widget | Remove static notification array in App.tsx, wire to live opportunities |

## Phase 4 — Smart Lead Import & AI Enrichment

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Add AI analysis to contact import | AI agent | Planned | Gemini API key | Update import flow to call Gemini Flash per contact batch |
| Add Tavily enrichment to contact profile | AI agent | Planned | Tavily API key | Enrich button on ContactProfile that searches and stores result |
| Build duplicate detection in import flow | AI agent | Planned | Phase 1 contacts API | Check each import row against existing contacts before creating |

## Phase 5 — Intelligence Dashboard

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Rebuild Dashboard with live Supabase data | AI agent | Planned | Phase 1 complete | Replace in-memory calculations with Supabase queries |
| Rebuild Reports with live Supabase data | AI agent | Planned | Phase 1 complete | Replace hardcoded rep name matching with DB-driven stats |
| Add order pattern analysis section | AI agent | Planned | Phase 1 WC wiring | Best-selling services, repeat order rate, revenue by month |

## Phase 6 — AI Communication Layer

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Add AI reply drafting to email inbox | AI agent | Planned | Gemini API key | Gemini Flash analyses email + contact history, suggests reply |
| Add AI reply drafting to WhatsApp | AI agent | Planned | Gemini API key | Same pattern, matched to pipeline stage |
| Migrate WhatsApp to Meta Cloud API | AI agent | Planned | Facebook Business verification | Rewrite api/whatsapp.ts handler for Meta webhook format |

## Product Backlog

| Task | Owner | Status | Blockers | Next Step |
| --- | --- | --- | --- | --- |
| Review production authentication approach | Team | Planned | Product/security decision | Compare demo login with Supabase Auth needs |
| Review Supabase RLS policies | Team | Planned | Production role model | Define least-privilege table policies |
| Verify WooCommerce credential storage | Team | Planned | Deployment env setup | Confirm secrets stay server-side |
| Start Facebook Business Verification | Product owner | Planned | None | Required for Phase 6 WhatsApp migration — takes 1-2 weeks |
| Get Gemini API key (free) | Product owner | Planned | None | Required for Phase 4 and 6 — console.cloud.google.com |
| Get Tavily API key (optional) | Product owner | Planned | None | Required for Phase 4 enrichment — tavily.com free tier |
| Run `supabase/email_schema.sql` in Supabase | Product owner | Planned | None | Enables permanent email storage instead of localStorage |

## Status Values

Use `Planned`, `In progress`, `Blocked`, `Review`, or `Done`.
