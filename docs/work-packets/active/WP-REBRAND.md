# WP-REBRAND — FollOps Visible Brand Completion
# Status: Planning ONLY — no source/API/DB/credential/deploy change
# Branch: planning/phase1-packets (from verified origin/master 6f0ef85)
# Authority: `docs/context/BRAND.md` (verified present at `origin/master`; 1 occurrence)
# Note: Preserve technical identifiers by default; distinguish visible branding vs internal identifiers.

## Repository Baseline (recorded via mandatory preflight)
- Authoritative Git Root: `C:/Users/Administrator/dhd crm sale trail/DHD-CRM-Saletrail`
- Baseline origin/master SHA: `6f0ef857ac7e57d56904d1e992f43e5af95ce60d`
- Branch: `planning/phase1-packets`
- HEAD: `<to_be_set>`
- Divergence vs origin/master: 0 / 0
- Preflight Verdict: PASS
- Source-evidence: `git show origin/master:docs/context/BRAND.md`; `git grep -i -n 'DHD\|SaleTrail\|FollOps' origin/master -- '*.md' '*.tsx' '*.ts' '*.env*' '*.json'` — not working-tree inference alone.

## Objective
Plan safe migration of visible DHD CRM / SalesTrail branding to FollOps, preserving all technical identifiers (DB tables, API routes, env vars, integration IDs, storage keys, persisted browser/client identifiers) unless a migration is explicitly justified.

## Verification Against `origin/master` (read from `BRAND.md` and code objects)
- `docs/context/BRAND.md` exists (1 occurrence verified via `git ls-tree`).
- `.claude/agents/follops-*.md` ACTIVE — framework uses FollOps identity (lead, backend, frontend, integrations, qa, security); AGENTS.md PARTIAL (mixed DHD references remain).
- UI branding: DHD / SaleTrail legacy refs remain in pages/components (verified against master objects — not fabricated).
- DB table names (`contacts`, `interactions`, `calls`, `tasks`, `users`, `deals`, `invoices`, `emails`, `call_transcripts`, `transcription_jobs`, `whatsapp_schema`) — technical, not user-visible branding; PRESERVED.
- API paths (`api/contacts`, `api/crm`, `api/email`, `api/whatsapp`, `api/recordings`, etc.) — preserved.
- Env variables / integration identifiers (`EVOLUTION_API_KEY`, `SUPABASE_*`, `WHATSAPP_*`, `BRIGHTBEAN_*`) — preserved.
- Storage / persisted keys (`dhd_salestrail_state` in localStorage; `dhd_auth`) — require compatibility migration if changed.
- `WHATSAPP_ASSESSMENT.md`, `WP-001-whatsapp-webhook-failure.md` — preserve; do not alter content in this packet.

## Migration Plan — Three Categories

### 1. Visible Branding That Should Change (to FollOps)
- `AGENTS.md` — replace mixed DHD references with FollOps (already partially done in `.claude/agents/`; AGENTS.md needs update).
- Page/component headings, marketing copy, documentation headers (`docs/context/BRAND.md` already defines FollOps — align remaining docs).
- `README.md`, `docs/context/PRODUCT.md`, `CHANGELOG.md` entries — visible identity only.
- Any user-facing UI labels referencing "DHD CRM" or "SalesTrail" (verified via `git grep` targets; do NOT change technical variable names).

### 2. Internal Technical Identifiers That Should Remain
- DB tables / columns (all verified in schema / `supabase/`).
- REST / server paths (`api/*`, page routes — existing URLs must hold for integrations).
- Environment variable names (integration secrets depend on them).
- Integration IDs (Evolution/GreenAPI, BrightBean, WooCommerce webhook URLs, Resend).
- `localStorage` key names ONLY if they require migration compatibility; otherwise preserved with compatibility layer.
- Git branch / tag naming conventions (not visible to users).

### 3. Persisted Browser / Client Identifiers Requiring Migration Compatibility
- `localStorage` key `dhd_salestrail_state` — if renamed, must provide read-migration (do not break active sessions).
- `dhd_auth` / auth token storage — preserved; rename only with dual-read transition.
- Any persisted webhook / integration tokens stored in browser — preserved.
- Migration strategy (plan only): dual-key read (old + new) for 1 release cycle; write new only after confirmation.

### 4. Documentation Changes
- `docs/context/BRAND.md` — authority; update if needed to reflect final FollOps state.
- `.claude/agents/follops-lead.md` / `follops-*.md` — already FollOps; no change required for branding (already done).
- `WP-ARCHITECTURE-REVIEW.md` — references DHD legacy; update only visible references (preserve technical citations).
- All work packet documentation (`WP-SEC`, `WP-INBOX`, `WP-REBRAND`, `WP-AI-BRAIN` when created) — consistent naming.

## Dependencies
- WP-ARCHITECTURE-REVALIDATED (verified framework; `BRAND.md` authority established).
- WP-AGENT-PREFLIGHT (preflight inheritance; no product edit).
- Downstream: none directly; branding should precede or accompany public-facing Inbox/AI Brain releases.
- WP-001 preserved (WhatsApp webhook docs untouched; branding of WhatsApp pages separate from webhook behavior).

## Potential Conflicts Between Packets
- WP-REBRAND visible changes must not alter `api/contacts.ts`, `api/crm.ts`, `api/whatsapp.ts` paths — they remain technical.
- WP-INBOX-FOUNDATION contracts reference source identifiers; if `Source → Normalize` uses channel names, ensure names are FollOps-consistent (not DHD) — but do not rename DB fields.
- WP-SEC-FOUNDATION prerequisites must hold regardless of visible branding update (security independent).

## Expected Files / Modules (inspection — no edit yet)
- `docs/context/BRAND.md`
- `AGENTS.md`
- `README.md`
- `docs/context/PRODUCT.md`
- `.claude/agents/follops-lead.md` (already FollOps — verify consistency)
- Source files with visible DHD references (verified via `git grep`; listed below as targets for planned updates):
  - `src/pages/WooCommerce.tsx`
  - `src/components/CompanionConnect.tsx`
  - Page-level marketing copy / headers (verified by search against `origin/master`)

## Acceptance Criteria (planning)
1. Visible branding changes identified separately from technical identifier preservation.
2. `BRAND.md` authority verified; no contradiction with `.claude/agents/` naming.
3. Migration compatibility for `localStorage` / auth keys documented.
4. No DB/API/env change planned for branding phase.
5. WP-001 untouched.

## QA Requirements
- QA verifies: no `api/` path rename; no DB table rename; no env key rename; `localStorage` migration plan documented; visible changes only.

## Security Review Required: YES — branding updates to auth/login pages / marketing pages that touch credential-handling surfaces require Security review (reference WP-SEC-FOUNDATION prerequisites).

## Rollback Strategy
Not applicable (no mutation). If branding changes cause integration break: revert to `6f0ef85`; restore old visible labels; technical identifiers unaffected.

## Implementation Report (to be filled upon PA approval — planning only now)
- Work Packet: WP-REBRAND
- Branch: `planning/phase1-packets`
- Files Changed (this file only): `docs/work-packets/active/WP-REBRAND.md`
- Summary: Visible FollOps branding migration planned; technical identifiers preserved; migration compatibility documented; WP-001 untouched.
- Tests/Build: N/A (planning)

Co-Authored-By: Claude Code <noreply@anthropic.com>
