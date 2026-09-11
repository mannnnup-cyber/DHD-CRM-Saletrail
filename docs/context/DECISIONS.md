# Decision Log — FollOps

Append-only log of architectural and product decisions.
Each entry includes date, decision, reason, implications, and status.

---

## 2026-05-11

**Decision:** Contacts = master record; Leads = active opportunities.
**Reason:** Product owner confirmed: leads are action items, contacts are the 360° view.
**Implications:** All data streams link to contacts; leads become filtered views.
**Status:** Implemented (Phase 1+2 complete)

## 2026-05-11

**Decision:** Use Google Gemini Flash free tier for AI analysis and reply drafting.
**Reason:** Cost-free start, 1,500 req/day, quality sufficient for triage.
**Implications:** No OpenAI billing for email analysis; Gemini API key in Settings.
**Status:** Implemented (Phase 4 complete)

## 2026-05-11

**Decision:** Keep Green API for WhatsApp now; migrate to Meta Cloud API in Phase 6.
**Reason:** Already working; migrate to official Meta Cloud API later.
**Implications:** Green API remains primary; Evolution API as secondary.
**Status:** In effect

## 2026-05-11

**Decision:** Skip Chatwoot — separate server/DB works against unified data goal.
**Reason:** Adds complexity without solving the core data unification problem.
**Implications:** No Chatwoot integration; WhatsApp stays in-app.
**Status:** Implemented

## 2026-05-11

**Decision:** Timeframes from CS manual — Quote: 2hrs, Email: 24hrs, Pickup: 3 days, Feedback: next day, Lapsed: 60 days.
**Reason:** Enforceable DHD service standards drive the missed-opportunity rules.
**Implications:** Automation rules use these timeframes; ActionList widget surfaces breaches.
**Status:** Implemented (Phase 3b complete)

## 2026-05-11

**Decision:** Skip DeepSeek — privacy risk (customer data through Chinese servers).
**Reason:** Data sovereignty concern for Jamaica customer data.
**Implications:** No DeepSeek integration; OpenAI + Anthropic only.
**Status:** Implemented

## 2026-05-11

**Decision:** External repos for reference only — integration cost exceeds value.
**Reason:** Build on existing schema rather than syncing with external CRM systems.
**Implications:** No external CRM integration; self-contained data model.
**Status:** Implemented

## 2026-06-25

**Decision:** Tasks page must use `/api/tasks` fetch calls — direct `supabase.from()` broken in browser.
**Reason:** `src/lib/supabase.ts` falls back to `{} as any` in Vite browser bundle; calling `supabase.from()` from page components throws "Ye.from is not a function".
**Implications:** All page components must use `/api/*` endpoints; DataContext wraps calls with `.catch(() => [])`.
**Status:** Implemented

## 2026-09-07

**Decision:** RLS lockdown on all 38 public tables; drop all 29 `USING (true)` policies.
**Reason:** Production database was anonymously readable/writable — critical exposure.
**Implications:** Anonymous reads return empty; anonymous writes rejected 42501. Rollback file in `dhd-backups/`.
**Status:** Done (production-tested)

## 2026-09-07

**Decision:** Legacy `SUPABASE_SERVICE_ROLE_KEY` remains ENABLED as fallback (owner deferral).
**Reason:** Owner decided to defer disabling the compromised legacy key; wants to verify invalidation after smoke suite passes on new key.
**Implications:** Supabase credential remediation is NOT complete. P0 open item. Old key must be disabled + invalidation verified before credential remediation is closed.
**Status:** OPEN P0 — deferred by owner

## 2026-09-07

**Decision:** Server handlers prefer `SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY` → anon fallback.
**Reason:** Modern secret-key path deployed and production-tested; old service_role key remains as fallback until P0 resolved.
**Implications:** All 11 privileged handlers use this precedence. New deployments must set `SUPABASE_SECRET_KEY`.
**Status:** Done

## 2026-09-07

**Decision:** BrightBean `/accounts/` HTTP 500 classified as external upstream regression.
**Reason:** Key accepted; `/me/` works; `/accounts/` returns 500 since 2026-09-07 — unrelated to our changes.
**Implications:** Social media module partially degraded; owner to report to BrightBean.
**Status:** Open — external issue

## Brand

**Decision:** Product name evolves to FollOps; tagline "Never Miss The Next Opportunity."
**Reason:** Rebrand from DHD CRM SalesTrail to reflect intelligence+action philosophy.
**Implications:** Visible branding may become FollOps; do NOT rename Git repos, DB tables, API routes, env vars, Supabase/Vercel projects.
**Status:** Approved for future implementation; not yet applied
