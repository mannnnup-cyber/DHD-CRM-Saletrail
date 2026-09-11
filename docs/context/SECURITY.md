# FollOps — Security Context

## Completed Containment (Verified)

| Step | Commit | Status |
|------|--------|--------|
| Git HEAD secret containment | `6c8b0d7` | Done — `.env.production` untracked, docs sanitized |
| Env-first secret precedence | `f6857da` | Done — Evolution/BrightBean/Resend/IMAP env → DB fallback |
| User-management auth/roles | `cc39569` | Done — JWT + role enforcement, owner/manager gates |
| Server handlers to service-role DB client | `ef1745b` | Done — 9 handlers prefer `SUPABASE_SERVICE_ROLE_KEY` |
| Modern `SUPABASE_SECRET_KEY` path | `2933dbd` | Done — all 11 privileged handlers prefer `SUPABASE_SECRET_KEY` with legacy fallback |
| RLS lockdown (production DB) | 2026-09-07 | Done — 38/38 public tables under RLS, 29 permissive policies dropped |
| Production backup/baseline | 2026-09 | Done — pg_dump trio + REST export + git bundle |
| Account-takeover containment (`api/users.ts`) | `cc39569` | Done — unauth probes 401, rep denial 403, manager allow 200 |

## Open Security Items

### P0 — Compromised Legacy Supabase `service_role` Key (Deferred by Owner)

The legacy `SUPABASE_SERVICE_ROLE_KEY` (in public git history since
commit `273ea13`) remains **ENABLED** as a fallback. The owner has
intentionally deferred disabling it.

**When done:** owner disables ONLY the legacy `service_role` key
(not anon/JWT/publishable/sb_secret), then AI runs smoke suite +
old-key invalidation probe. Rollback = re-enable key (instant, no
redeploy).

**Supabase credential remediation is NOT complete until this lands.**

### Other Open Items

- **Steps 7-12 — Rotate remaining compromised credentials:** Evolution, BrightBean, Resend, OpenAI, IMAP/Gmail (verify credential type first)
- **Step 13 — `WC_WEBHOOK_SECRET` + delete junk `app_settings` rows**
- **Step 14 — `CRON_SECRET` + cron header fix** (automation never ran; header check must read `Authorization: Bearer`)
- **Step 16 — Git history rewrite** (LAST; 273ea13 message contains Evolution key; force-push + re-clone; old service_role key invalidation MUST precede or accompany)
- **Stage 2 — Full API auth redesign, `app_settings` migration, staging** (encrypted secret storage decision needed)
- **evolution_user DB role** — role exists with publicly-known password (was in `docker-compose.yml`); disable when authorized
- **Webhook security** — WooCommerce webhook signature checks fail open; WhatsApp webhook has no signature check
- **Git history cleanup** — old secrets in commit `273ea13` message and earlier

## RLS State

- All 38 public tables: RLS enabled
- All 29 `USING (true)` policies: dropped
- 16 tables previously had RLS fully disabled — now enforced
- Anonymous reads verified returning no private data
- Anonymous writes verified rejected by RLS
- Rollback file: `dhd-backups/rollback-rls-lockdown-20260907.sql`

## Supabase Credential Precedence (Current)

`SUPABASE_SECRET_KEY` → `SUPABASE_SERVICE_ROLE_KEY` → anon fallback
(where applicable)

## Security-Sensitive Files

- `api/users.ts` — auth + role enforcement (security-sensitive)
- `api/woocommerce-webhook.ts` — public endpoint, needs signature validation
- `api/whatsapp.ts` — webhook receiver, no signature check
- `api/social.ts` — handles BrightBean API key
- `api/email.ts` — IMAP credentials
- `api/settings.ts` — secret storage/masking
- `src/lib/auth.ts` — token helper for Authorization headers
- `.env.production` / `.env.local` — never commit, never print

## Rules

- Never place actual credentials in documentation
- Never print secrets in chat, reports, or work packets
- Never commit `.env` files or production credentials
- Do not rotate credentials without explicit owner authorization
- Security agent may recommend changes but must not autonomously mutate production credentials, RLS, production DB state, or destructive infrastructure
