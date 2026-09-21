# WP-SEC-FOUNDATION — Security Foundation & Remaining Risk
# Status: Planning ONLY — no mutation authorized
# Branch: planning/phase1-packets (from verified origin/master 6f0ef85)
# Preflight: PASS (fetch done; remote = mannnnup-cyber/DHD-CRM-Saletrail.git)
# Note: No product code / DB / RLS / credential change authorized.

## Repository Baseline (recorded during mandatory preflight)
- Authoritative Git Root: `C:/Users/Administrator/dhd crm sale trail/DHD-CRM-Saletrail`
- Baseline origin/master SHA: `6f0ef857ac7e57d56904d1e992f43e5af95ce60d`
- Branch: `planning/phase1-packets`
- HEAD: `<new_sha_after_commit>`
- Divergence vs origin/master: 0 / 0 (branch from fetched master)
- Worktree: single (multi-worktree not required; no nested .git conflict)
- Preflight Verdict: PASS
- Source-evidence method: `git show origin/master:<path>`, `git grep`, `git ls-tree` (not working-tree inference)

## Objective
Plan security prerequisites specifically required before Unified Inbox (WP-INBOX-FOUNDATION) and AI Brain / Call Intelligence production expansion — without mutating any security state.

## Verification Method (read-only, against origin/master)
Claims below verified via `git show origin/master:docs/context/SECURITY.md`, `git grep service_role origin/master -- '*.ts' '*.md' '*.sql'`, `git ls-tree -r origin/master --name-only | grep -E 'security|rls|cred'`. No working-tree assumption.

## Verified Security State (re-verified against `6f0ef85`)

### Already Remediated (verified in `docs/context/SECURITY.md` — completed containment)
- Git HEAD secret containment (`6c8b0d7`) — `.env.production` untracked; docs sanitized.
- Env-first secret precedence (`f6857da`) — Evolution/BrightBean/Resend/IMAP env → DB fallback.
- User-management auth/roles (`cc39569`) — JWT + role enforcement; owner/manager gates.
- Server handlers migrated to service-role DB client (`ef1745b`) — 9 privileged handlers prefer `SUPABASE_SERVICE_ROLE_KEY`.
- Modern `SUPABASE_SECRET_KEY` path (`2933dbd`) — 11 privileged handlers prefer `SUPABASE_SECRET_KEY` with legacy fallback.
- RLS lockdown (`2026-09-07`) — 38/38 public tables under RLS; 29 permissive policies dropped.
- Production backup/baseline (`2026-09`) — pg_dump trio + REST export + git bundle.
- Account-takeover containment (`api/users.ts`) (`cc39569`) — unauth 401; rep denial 403; manager allow 200.

### Verified Remaining Vulnerabilities (must not be hidden by "done" claims)
1. **P0 — Compromised Legacy Supabase `service_role` Key (DEFERRED BY OWNER)** — in public git history; legacy `SUPABASE_SERVICE_ROLE_KEY` still referenced/fallback in code (`api/`. handlers). No rotation authorized in this packet.
2. **Git-history secret exposure** — `.env.production` untracked now, but prior commits contain secrets; requires history-rewrite authorization (not granted; escalated to owner).
3. **Webhooks / external integrations — authentication gaps:** Evolution (WhatsApp/GreenAPI), BrightBean, WooCommerce webhook paths (`src/pages/WooCommerce.tsx`) — need signature/secret verification review (not mutated here).
4. **Recording / device authentication** — `api/recordings.ts` (Companion/Whisper/transcription); device-level access not fully enforced; PII/AI audit trail partial.
5. **PII / AI audit requirements** — `api/email.ts`, `api/recordings.ts` (AI pipeline: gpt-4o-mini / whisper-1) — audit logging of model inputs/outputs and data retention policy not documented fully.
6. **Rate limiting / CSP** — not fully configured; Webhook and AI endpoints exposed without documented throttling or content-security policies.
7. **`evolution_user` concern** — exposed identity / credential exposure risk (referenced in security docs); requires verification.

### Accepted / Deferred Risks (explicit, not implicit)
- **Legacy service-role exception (handled, not hidden):** `SUPABASE_SERVICE_ROLE_KEY` kept as fallback; owner explicitly deferred rotation (per `SECURITY.md` and `follops-lead.md` prohibited-actions: "May NOT disable the legacy `SUPABASE_SERVICE_ROLE_KEY` — that's a deferred P0 owner decision"). No authorization to disable in this packet.
- **Git-history exposure:** deferred; requires owner authorization + explicit approval (escalation trigger: "Implementation requires Git history rewrite"). Not performed.
- **Rate limiting / CSP:** deferred; prerequisites for Inbox/AI Brain production.

### Items Requiring Owner Authorization Before Any Security Mutation
- Rotation of legacy `SUPABASE_SERVICE_ROLE_KEY` (P0 — deferred).
- Git-history rewrite to remove secrets (escalation trigger present; not authorized).
- Disable of legacy service-role fallback in new code paths (prohibited until owner decides).
- Any RLS policy modification (currently 38/38 locked; any change needs Security review + owner sign-off).
- Credential rotation for Evolution / BrightBean / Resend / IMAP (env-first already in place; rotation needs owner).

### Security Prerequisites Specifically Required Before Unified Inbox / AI Brain / Call Intelligence Expansion
- (A) Webhook auth verified for all integration paths (Evolution/WhatsApp, WooCommerce, BrightBean) — not yet fully verified.
- (B) AI audit trail complete for `api/email.ts`, `api/recordings.ts` — model calls (gpt-4o-mini / whisper-1) must log inputs/outputs retention; not documented.
- (C) Recording/device auth enforced (`api/recordings.ts` 478 lines — Companion/Whisper/transcription_tables) — access control on transcription tables verified.
- (D) Rate limit + CSP defined for AI endpoints (`/api/email`, `/api/recordings` ingestion) — missing.
- (E) PII handling policy written and approved (customer/private data through Inbox / AI Brain / Call Intelligence pipeline).
- (F) RLS containment verified at 38/38 (current state satisfied; must hold through any new table/column additions from Inbox/AI Brain).

## Scope / In Scope / Out of Scope
In scope (planning only): documentation of verified security state; prerequisite list; dependency mapping; risk classification; prerequisites for downstream packets.
Out of scope: any mutation to `api/`, DB, RLS, credentials, `.env`, deployment, git-history rewrite, service-role disable.

## Dependencies
- WP-ARCHITECTURE-REVALIDATED (verified framework; `follops-lead.md` preflight steps 9/10); WP-AGENT-PREFLIGHT (approved); `docs/context/SECURITY.md`; `docs/context/BRAND.md`.
- Downstream: WP-INBOX-FOUNDATION (needs webhook auth + AI audit prerequisites); WP-AI-BRAIN / WP-CALL-INT (hold until prerequisites (A)-(F) met); WP-001 stays separate (do not alter WhatsApp webhook behavior here).

## Expected Files / Modules (planning only — inspection targets)
- `docs/context/SECURITY.md`
- `.claude/agents/follops-security.md`
- `api/users.ts` (auth/roles; account-takeover containment at `cc39569`)
- `api/recordings.ts`, `api/email.ts`, `api/crm.ts`, `api/whatsapp.ts` (integration/auth surfaces)
- `supabase/` schema / RLS definition files
- `src/pages/WooCommerce.tsx` (webhook docs; legacy refs)

## Acceptance Criteria (planning verification only — no code)
1. Security state documented with verified `origin/master` citations.
2. Legacy service-role exception explicitly stated (not hidden); no mutation authorized.
3. Verifiable prerequisites (A)-(F) listed with owning packet reference.
4. WP-001 not altered; no WhatsApp webhook diagnosis/fix.
5. Security review prerequisite for WP-INBOX-FOUNDATION recorded.

## QA Requirements
- QA must verify: no credential mutation; no RLS change; no source edit to `src/` or `api/`; `follops-lead.md` preflight steps preserved; `SECURITY.md` citations point to `6f0ef85` objects.

## Security Review Required: YES — mandatory before any downstream security-sensitive packet (WP-INBOX / WP-AI-BRAIN / WP-CALL-INT). Security agent must verify prerequisites (A)-(F) satisfied.

## Rollback Strategy
Not applicable (no mutation performed). If prerequisites later require mutation: roll back to `6f0ef85`; re-run preflight; get owner authorization; commit separately.

## Implementation Report (to be filled upon PA approval of this planning packet — not yet)
- Work Packet: WP-SEC-FOUNDATION
- Branch: `planning/phase1-packets`
- Files Changed (this planning file only): `docs/work-packets/active/WP-SEC-FOUNDATION.md`
- Summary: Security prerequisites planned; no mutation; legacy exception preserved.
- Commit SHA: (to be set after commit)
- Build/Test: N/A (documentation-only planning)

Co-Authored-By: Claude Code <noreply@anthropic.com>
