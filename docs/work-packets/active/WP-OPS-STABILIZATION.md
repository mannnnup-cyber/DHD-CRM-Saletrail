# WP-OPS-STABILIZATION — FollOps Operational Stabilization Audit

**Status:** READ-ONLY DIAGNOSTIC — NO PRODUCTION MUTATION
**Role:** FollOps Lead (diagnostic coordination)
**Date:** 2026-10-05
**Branch:** WP-OPS-STABILIZATION (new audit packet; pushed; not merged to master)
**Authoritative master (fetched):** `d76e0dbe11eefe0547582e80b751a0da47853d38` (matches expected green master)
**Remote audit branch SHA:** `ca8e9125b5a67398cd030c6d641ac4081afbc85a`

---

## PRE-FLIGHT (MANDATORY)

| Item | Value |
|---|---|
| Repository root (authoritative) | `C:\Users\Administrator\DHD-CRM-Saletrail` |
| Remote | `https://github.com/mannnnup-cyber/DHD-CRM-Saletrail.git` |
| Authority master SHA | `d76e0dbe11eefe0547582e80b751a0da47853d38` |
| Expected green master | `d76e0dbe11eefe0547582e80b751a0da47853d38` |
| Verification | `git show d76e0d...` confirmed; `git fetch origin` completed; master updated `8606139..d76e0db` |
| Current worktree branch | `WP-ARCHITECTURE-REVALIDATED` |
| Worktree HEAD | `63a449db1c2137719778134b8831cbfb674f738a` |
| Ahead/behind origin/master | `2 ahead / 22 behind` (local branch diverged; not blocking audit) |
| WP-001-whatsapp-fresh (local) | NOT present as local branch (only `WP-001-whatsapp` local) |
| WP-001-whatsapp-fresh (remote) | `origin/WP-001-whatsapp-fresh @ 7b6979b6336c4243780e823fb28be071bc11dadb` |
| Evidence SHA 3ba1fda... | PRESENT (`git cat-file -t` = commit) |
| WP-001 branch files changed vs master | 7 files, ~460 insertions / ~16 deletions (`src/lib/wp001/webhookSanitizer.*`, tests, docs) |
| Verdict | Preflight PASS. Stale local master not a blocker; WP-001 branch preserved untouched. |

---

## OPS-01 — VERCEL RESOURCE AUDIT

### Method
Static repository analysis (no Vercel admin/tool access verified for route-level usage). `vercel.json` inspected. Recurring mechanisms inventoried via grep over `src/` and `api/`.

### Recurring / Network-Triggered Inventory (documented from code)

| Source | File | Function / Trigger | Target | Interval | Active open? | Active closed? | Retry / loop? | Risk class |
|---|---|---|---|---|---|---|---|---|
| `vercel.json` | `vercel.json` | cron `0 9 * * *` | `/api/crm?target=automation&action=run` | Daily 09:00 | N/A | N/A | None | Low |
| `src/pages/Sidebar.tsx` | Sidebar.tsx | `setInterval(fetchUnread, 60000)` | unread fetch | 60s | Yes (sidebar mounted) | No | None | Low-Med |
| `src/context/AuthContext.tsx` | AuthContext.tsx | `setTimeout(doRefresh, 60_000)` / msUntilRefresh | auth refresh | ~60s + token expiry | Only when auth active | No | No retry loop | Low |
| `src/pages/Settings.tsx` | Settings.tsx | `pollWhatsAppStatus` `setTimeout(..., 1000)` recursive | `/api/whatsapp` | ~1s per attempt (cap >10) | Only during manual verify/scanning | No (stops) | Stops after ~10 attempts; error path continues | Med |
| `src/pages/WhatsApp.tsx` | WhatsApp.tsx | `setInterval(loadChats, 30000)` | `/api/whatsapp` (chat list) | 30s | Yes (while page open) | No | No retry | **Med-High** (per open tab; multi-tab multiplicative) |
| `src/pages/WhatsApp.tsx` | WhatsApp.tsx | call timer interval (line 824) | call timer UI | ~1s | While call open | No | No | Low |
| `src/pages/WhatsApp.tsx` | WhatsApp.tsx | mount: checkWebhookStatus / loadChats / loadEvolutionConfig / syncContactNames (fire-and-forget POST) | `/api/whatsapp` | Once at mount | Yes (page open) | No | catch(()=>{}) silent | Low |
| `src/pages/WhatsApp.tsx` | WhatsApp.tsx | `setTimeout` scroll + toast clearing | UI only | 100ms / 5s | Yes | No | No | Client-side only |

### Request-Volume Estimates (reasonable upper-bound)

- WhatsApp page open, 1 tab: 30s chat poll = 120/hr; webhook/check ~once per interaction; mount sync = 1. **~120–240 req/hr per open tab** (mostly `/api/whatsapp` + Supabase real-time).
- WhatsApp verify/scan flow: 1s poll x 10 attempts = ~10 req; self-terminating. Not sustained.
- Sidebar unread: 60s = 60/hr per open session.
- Auth refresh: ~1/min per authenticated session.
- Daily Vercel cron: 1 invocation/day.
- **No recurring frontend poll to `/api/email`, `/api/users`, `/api/recordings`, `/api/crm`** found outside automation cron.

### Top 5 Highest-Volume Suspects (static)

1. WhatsApp `loadChats` 30s interval (`WhatsApp.tsx:953`) — per-tab, persistent while page open.
2. Sidebar unread 60s interval (`Sidebar.tsx:109`) — per open session.
3. AuthContext refresh ~60s / token-margin (`AuthContext.tsx`) — per authenticated session.
4. WhatsApp `pollWhatsAppStatus` recursive 1s (`Settings.tsx`) — only active during manual verify; self-terminating at >10 attempts.
5. Vercel daily cron (`vercel.json`) — 1/day to CRM automation.

### Evidence of Accidental Loop?
**NOT PROVEN.** No unbounded `setInterval` or recursive `setTimeout` without exit condition found in `api/whatsapp.ts` or `src/pages/WhatsApp.tsx`. WhatsApp polling has exit conditions; Auth refresh uses timeouts with token-margin exits.

### Evidence of Webhook Recursion?
**NOT PROVEN** in source. `api/whatsapp.ts` webhook receiver does not call itself or trigger upstream callbacks that loop back.

### Evidence of Excessive Failure Retries?
**PARTIAL.** `pollWhatsAppStatus` retries on error every 1s but caps at >10 attempts; not unbounded. `loadChats` has no retry — relies on 30s interval. `sendEmail` (Resend) has no retry loop; fails once per call. No retry loop on `/api/email` endpoint found.

### Vercel Route-Level Usage Verified?
**NOT VERIFIED.** Vercel CLI present (v52.0.0) but unauthenticated in this environment; no `vercel logs`, `vercel analytics`, or dashboard access exercised. Route-level invocation counts not obtained. Static suspects only — runtime evidence unavailable. Owner/PA must supply via Vercel dashboard, API, or logs.

### Vercel Usage Period
**UNKNOWN.** The 2.4M invocations / 1.2M CDN requests dashboard figures have no attached billing-period start/end in the repository. The audit cannot establish the period. Upper-bound arithmetic below is per-interval rates, not period totals.

### Polling Arithmetic (from actual code)

| Mechanism | Interval | Requests/hr | Requests/day / open tab | Multiple components? | Stops when page closed? | Failure/retry behavior |
|---|---|---|---|---|---|---|
| WhatsApp `loadChats` (`WhatsApp.tsx` chat-list `setInterval`) | 30s | 120 | 2,880 | Yes — any open WhatsApp tab issues same `GET /api/whatsapp?action=chatsFromDb` (+ fallback `syncHistory`/`chats`) | Yes — `clearInterval` on unmount | None — relies on 30s interval |
| WhatsApp verify flow `pollWhatsAppStatus` (`Settings.tsx` + `WhatsApp.tsx`) | 1s recursive `setTimeout` | 3,600 if stuck | 86,400 if stuck | One per verify session | Yes — self-terminates at `attempt > 30` (reduced from 120); UI error cap `attempt > 10` | Retries on every error until cap |
| Sidebar `fetchUnread` (`Sidebar.tsx`) | 60s | 60 | 1,440 | One per open app (sidebar mounted) | Yes — `clearInterval` on unmount | None |
| AuthContext refresh (`AuthContext.tsx`) | ~60s + token expiry | ~60 | ~1,440 | One per authenticated session | Yes — timeout exits; logout on second failure | One retry after 60s on network blip, then logout |
| Vercel cron (`vercel.json`) | Daily 09:00 | — | 1 | N/A | N/A | None |

**Arithmetic for 2.4M / 1.2M plausibility:**
- 1 open WhatsApp tab × 30s poll = 2,880/day. To reach 2.4M function invocations/day purely from this poll: 2,400,000 / 2,880 ≈ 833 concurrent open tabs/users. **Plausible only with many concurrent open tabs/users or additional unmeasured sources (Supabase real-time, static asset CDN, other functions).**
- The audit CANNOT confirm the billing period the 2.4M covers. If period is 30 days: 80,000/day average — 28 open tabs at 30s poll, or combination. If period is 1 day: 833 concurrent tabs. **Period UNKNOWN.**
- No single mechanism proven to be the source without Vercel route-level data.
- CDN requests (1.2M) likely include static assets; only a subset are function invocations.

### Conclusion (OPS-01)
- 2.4M invocations / 1.2M CDN requests are **plausibly** explained by a combination of many concurrent open WhatsApp tabs (30s poll) + open auth sessions + sidebar refresh across users/browsers + CDN caching of static assets (not all function invocations). No single runaway loop proven.
- Greatest reduction: review whether WhatsApp page is left open by multiple users/agents; consider reducing `loadChats` interval or using Supabase real-time subscription (already used for new messages inside open chats) rather than 30s polling for list refresh.
- No production deployment required for audit conclusion.

---

## OPS-02 — EMAIL ARCHITECTURE AND DELIVERY

### Current Architecture (inventory from source + docs)

**INBOUND:** IMAP implementation present (ref `docs/context/INTEGRATIONS.md`). Credentials via env/DB fallback; sync mechanism not fully detailed; no frequency confirmed from `api/email.ts` alone.

**OUTBOUND:**
- `api/email.ts` — general outbound
- `api/users.ts` — invitation + password-reset + reactivation (uses `sendEmail` helper calling `https://api.resend.com/emails`)
- `sendEmail` uses: sender `DHD SalesTrail <support@dirtyhanddesigns.com>`; endpoint `api.resend.com`; auth `Bearer RESEND_API_KEY`
- Outbound uses Resend only (no SMTP/Nodemailer path in `api/users.ts` reset/invite; `api/email.ts` may differ — not expanded fully)

### Password-Reset Sequence (exact, from `api/users.ts`)

1. Admin requests reset/invite -> `generateTempPassword()` (8-char lowercase + 8-char uppercase + `!`)
2. `supabaseAdmin.auth.admin.createUser` or `updateUser` -> password set to temp
3. `supabaseAdmin.from('user_profiles').update(... must_change_password: true ...)`
4. `sendEmail()` to user with plaintext temporary password
5. If Resend fails -> `sent: false, reason: 'no_key'|'api_error'|'network_error'` -> UI reports:
   > "Password was reset, but the email could not be delivered. The new password was NOT changed to anything shown here — retry the reset once email sending is working."

**ASSESSMENTS:**
- Lockout risk: LOW (password changed to known temp; user can log in with it, then must change).
- Security risk of emailing plaintext temp: HIGH — temporary password exposed in email, no expiration, transmitted in plaintext.
- Retry semantics: NONE for email; password already changed regardless of delivery.
- Auditable: Partial — Supabase auth log + Resend response; no delivery webhook confirmation.

### Email Failure Classification (from code + docs; NOT from production log verification)

| Cause | Evidence | Status |
|---|---|---|
| A. missing `RESEND_API_KEY` | Code checks `if (!RESEND_API_KEY) return {sent:false, reason:'no_key'}` | Possible; not verified against live env |
| B. invalid/expired API key | Not verifiable from repo alone | UNKNOWN |
| C. unverified sending domain (`dirtyhanddesigns.com`) | `docs/context/INTEGRATIONS.md` and `docs/agents/INTEGRATIONS.md`: "Broken — suspected domain verification; unconfirmed" | **NOT PROVEN** — domain verification not demonstrated from repo/runtime |
| D. invalid sender address | Sender is `support@dirtyhanddesigns.com`; no bounce evidence | Not proven |
| E. Resend account restriction | Not verifiable without account access | UNKNOWN |
| F. API error | `api_error` handled; no runtime log reviewed | UNKNOWN |
| G. network/runtime error | `network_error` handled | UNKNOWN |
| H. Vercel resource/runtime issue | Not isolated from other causes | UNKNOWN |
| I. application bug | Sequence is structured (password set, then email) — not a logic bug | Not the primary cause |
| J. other | — | — |

**VERDICT:** **DOMAIN VERIFICATION NOT PROVEN. RESEND FAILURE CLASSIFICATION NOT PROVEN.** Repository documentation repeatedly notes suspected domain verification failure (`docs/context/INTEGRATIONS.md`, `docs/agents/INTEGRATIONS.md`) but no proof (DNS records, Resend dashboard, delivery webhook, Vercel logs) was produced in this audit. No production secrets or logs exposed; no env values printed.
- Production log inspection for actual `api_error` status/body: NOT AVAILABLE (no Vercel log access exercised; no Resend dashboard access). `RESEND FAILURE ROOT CAUSE NOT PROVEN`.
- Domain verification for `dirtyhanddesigns.com` in Resend: **NOT VERIFIED** (no DNS/provider tooling exercised). `RESEND DOMAIN VERIFICATION NOT PROVEN`.

### Recommended Target Architecture (no implementation in this audit)

- Conceptual abstraction: `EmailProvider` interface (`sendTransactional`, `sendMessage`, `getDeliveryStatus`)
- Providers: `ResendProvider` (current, broken), `BrevoProvider` (transactional alternative — evaluate domain/auth), `SMTPProvider` (optional, if DHD has existing mailbox SMTP for CRM correspondence), `SupabaseAuthProvider` (auth-specific messages only — recovery links/tokens).
- Conceptual separation: INBOUND = IMAP (existing mailbox); TRANSACTIONAL OUTBOUND = Resend/Brevo/SMTP for password invites/notifications; AUTH-SPECIFIC = Supabase Auth recovery flow; CRM HUMAN CORRESPONDENCE = existing mailbox SMTP if viable.
- **Concrete recommendation (preliminary, requires owner confirmation):**
  - Do NOT switch provider solely on price.
  - For password reset: move to Supabase Auth recovery flow (expiring reset link/token, user chooses new password, no plaintext temp email). Eliminates security risk regardless of provider.
  - For transactional email (invites, notifications): evaluate Brevo as alternative to broken Resend, but only after domain verification and delivery testing; maintain provider abstraction so future switch is low-cost.
  - Domain verification must be proven (DNS + provider dashboard) before declaring provider fixed.

---

## OPS-03 — WHATSAPP WP-001 REVALIDATION

### WP-001 Current State (reconciled from evidence files + branch)

- **Packet status:** `In Progress` (per WP-001 doc metadata; NOT "blocked on live verification" only)
- **Priority:** P0
- **Branch HEAD:** `WP-001-whatsapp-fresh` remote `origin/WP-001-whatsapp-fresh @ 7b6979b6336c4243780e823fb28be071bc11dadb`; local `WP-001-whatsapp-fresh` not present (remote only).
- **Branch relationship to master:** 7 files changed, 460 insertions / 16 deletions vs master (`src/lib/wp001/webhookSanitizer.*`, tests, docs).
- **Production diagnostic already deployed:** NONE — this packet is read-only diagnostic; no production deployment.
- **Verified Evolution state (owner-supplied, unmodified):** `{success:true, connected:true, state:"open", instanceName:"dhd-crm-wa"}` — proves authentication, NOT webhook health.
- **Verified webhook URL (owner-supplied, unmodified):** `https://dhd-crm-saletrail.vercel.app/api/whatsapp` — configured; does NOT prove delivery reaching FollOps.
- **lastMessageAt evidence:** `2026-09-05T04:16:10+00:00` — stale relative to current date; no new inbound message proven since.
- **Unresolved Layer A/B/C distinction (per WP-001 classification):**
  - Layer A (session/provider): NOT root cause — connectionState open/authenticated.
  - Layer B (webhook registration): PRIMARY hypothesis — webhook missing/stale after Evolution restart.
  - Layer C (callback delivery): SECONDARY — URL may be stale or events missing (esp. MESSAGES_UPSERT).
  - Layer D (handler parsing): NOT cause — handler correctly parses Evolution v2 Baileys format.
  - Layer E (persistence): NOT testable — no messages reaching handler.
  - Layer F (presentation): NOT cause — UI correctly shows gap warning.
- **Latest PA-reviewed diagnostic status:** Diagnosis complete per `docs/diagnosis-findings.md`; leading hypothesis = Layer B + C pending live verification. Next approved step: verify MESSAGES_UPSERT registration + webhook POST evidence + lastMessageAt vs actual inbound time. **NO reconnect / webhook-set / instance recreation / QR rescan / credential rotation performed in this audit.**
- Evidence SHA `3ba1fda52f6c0ae8de4e1426ddc48860d8181c82` present and branch preserved untouched.

### Owner-Supplied Production Evidence (interpreted correctly)

```
status: { success: true, connected: true, state: "open", instanceName: "dhd-crm-wa" }
webhookInfo: { success: true, configured: true, url: "https://.../api/whatsapp", lastMessageAt: "2026-09-05T04:16:10+00:00" }
```

**Interpretation (per instruction, correctly):** Evolution authentication working; instance open; webhook URL configured; **does NOT prove new inbound message received**; **does NOT prove MESSAGES_UPSERT registered/enabled**; **does NOT prove webhook delivery reaching FollOps**.

### WhatsApp-Sourced Request Volume (relationship to OPS-01)

From `api/whatsapp.ts` review (no mutation; read-only):
- `pollWhatsAppStatus` / `autoConfigureWebhook` / reconnect attempts exist but are user-initiated or self-terminating (not unbounded loops).
- `loadChats` 30s interval (`WhatsApp.tsx`) is the primary sustained load generator.
- No evidence that WhatsApp failure is **causing** Vercel overload; direction of causality: if WhatsApp is frequently reopened/reconnected by users trying to fix it, that increases `loadChats` polling — but this is user-driven, not an automatic loop.
- **No unproven relationship asserted.** WhatsApp polling contributes to request volume independently of webhook failure.

### Next Approved Diagnostic Step (WP-001)

Per existing packet: verify MESSAGES_UPSERT registration status via Evolution API; verify whether webhook POSTs actually reach FollOps endpoint (check Vercel function logs for `/api/whatsapp` POSTs with recent timestamps); verify last inbound message time vs `lastMessageAt`. **NO reconnect / webhook-set / instance recreation / QR rescan / credential rotation performed in this audit.**

---

## CROSS-SYSTEM CONCLUSION

| System | Failure / Observation | Classification |
|---|---|---|
| OPS-01 Vercel usage | High invocation / CDN totals; plausible multi-tab polling + auth refresh; no proven runaway loop | **NO EVIDENCE OF RELATION** (independent of email failure) |
| OPS-02 Email/Resend | Broken outbound; domain verification unproven; password reset sends plaintext temp | **NO EVIDENCE OF RELATION** (independent of Vercel usage) |
| OPS-03 WhatsApp WP-001 | Webhook delivery unproven; reconnect needed; evidence preserved | **POSSIBLY RELATED** (WhatsApp open tabs contribute to load; not root cause of overload) |

**Conclusion:** Three independent failures (OPS-01, OPS-02, OPS-03) with partial load interaction (WhatsApp use increases load but does not cause failure). No evidence of single root cause, webhook recursion, or email retry loop driving volume.

---

## PRIORITY / REMEDIATION PLAN (READ-ONLY — NO IMPLEMENTATION)

| Priority | Issue | Evidence | Files | Proposed change (future; not applied) | Risk | Expected benefit | Owner action? | Deploy? |
|---|---|---|---|---|---|---|---|---|
| P0 (security/integrity) | Password reset sends plaintext temporary password via email | `api/users.ts` sequence; security review required | `api/users.ts` | Replace with Supabase Auth recovery flow (expiring link, user chooses password); separate auth email from CRM correspondence | Low if done after verification | Eliminates plaintext exposure; improves auditability | Yes — design approval needed | Yes — after test |
| P1 (broken prod) | Resend outbound broken; domain verification unproven | `docs/` notes; code uses `api.resend.com`; no proof of verification | `api/users.ts`, env/config | Verify domain (DNS + provider dashboard); if not fixable, implement provider abstraction and switch; test delivery | Med (provider change affects all transactional) | Restores email delivery; enables invites/resets | Yes — confirm domain status first | Yes |
| P2 (resource/reliability) | WhatsApp 30s chat poll is highest sustained frontend load per open tab | `WhatsApp.tsx:953`; 30s interval persistent | `src/pages/WhatsApp.tsx` | Use Supabase real-time (already used for open-chat messages) for chat list updates; extend interval or make event-driven; investigate multi-tab usage | Low | Reduces requests/hour per user; lowers CDN/function load | Yes — UX check | Yes |
| P2 (resource) | Auth refresh ~60s + sidebar unread 60s + WhatsApp page open across users | Multiple components | `AuthContext.tsx`, `Sidebar.tsx`, `WhatsApp.tsx` | Review whether intervals can be event-driven or extended; confirm no multi-tab duplication | Low | Moderate reduction; mainly reliability | No — optional optimization | Optional |
| P3 (architecture) | Email provider hard-coded (Resend) without abstraction | `sendEmail()` direct to Resend | `api/users.ts`, new abstraction file | Create `EmailProvider` interface + `ResendProvider`/`BrevoProvider`; separate auth-specific from transactional | Low | Future provider switches low-cost | No — future | No |
| P3 (WP-001) | WhatsApp webhook delivery unverified; reconnect flow needs evidence | `WP-001-whatsapp-webhook-failure.md`; `api/whatsapp.ts` read | `docs/work-packets/active/`, `api/whatsapp.ts` | Follow WP-001 approved diagnostic: verify MESSAGES_UPSERT, webhook POST evidence, last message vs lastMessageAt; do NOT reconnect without evidence | Low (read-only steps first) | Identifies root cause; avoids repeated reconnect | Yes — WP-001 owner | Only after verification |

---

## QA VERDICT

- Static analysis completed: YES (grep over `src/`, `api/`, `vercel.json`)
- No production code modified: CONFIRMED (`APPLICATION CODE CHANGED: NO`)
- No deployment performed: CONFIRMED (`PRODUCTION DEPLOYED: NO`)
- No Vercel plan/config changed: CONFIRMED (`VERCEL PLAN CHANGED: NO`)
- No WhatsApp/Evolution mutation: CONFIRMED (`EVOLUTION MUTATED: NO`; no reconnect, no webhook-set, no instance recreation, no QR rescan)
- No email provider mutation: CONFIRMED (`EMAIL PROVIDER MUTATED: NO`; no DNS change, no key rotation, no Brevo switch executed)
- No Supabase mutation: CONFIRMED (`SUPABASE MUTATED: NO`; RLS and service-role not changed; no user reset executed)
- WP-001 branch intact: CONFIRMED (branch `WP-001-whatsapp-fresh` remote preserved; local `WP-001-whatsapp` untouched; evidence SHA present)
- Route-level Vercel usage: NOT VERIFIED (no logs/analytics accessed)
- Runaway loop proven: NO (exit conditions exist; no unbounded loops found)
- Webhook recursion: NOT PROVEN
- Resend failure classification: NOT PROVEN (suspected domain verification; no proof produced)
- Domain verification status: **RESEND DOMAIN VERIFICATION NOT PROVEN**
- Cross-system relationship: **NO EVIDENCE OF RELATION** (independent failures with partial load interaction)
- QA verdict: PASS

---

## SECURITY VERDICT

- Secrets exposure: NONE. No `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Evolution keys, SMTP passwords, JWTs, or customer message content printed in this document or terminal output. No values copied from `.env` or `app_settings`.
- Password reset: reviewed; NOT implemented; recommendation is to eliminate plaintext temp-password email entirely (Supabase recovery link). No user reset performed during audit.
- Webhook endpoint: `api/whatsapp.ts` is public webhook receiver — security review remains separate (referenced in WP-001 doc); no authentication/signature changes made.
- Credential rotation / exposure remediation: NOT EXPANDED into this audit (existing unresolved security work kept separate per instruction).
- Public integration endpoints: reviewed read-only; no mutation.
- Security verdict: PASS

---

## KNOWN UNKNOWNS

- Actual Vercel route-level invocation counts per endpoint (`/api/whatsapp`, `/api/users`, `/api/email`, etc.) — tooling/log access not exercised.
- Live `RESEND_API_KEY` status and domain verification state for `dirtyhanddesigns.com` (no Resend dashboard / DNS verification performed; per instruction, no DNS change).
- Whether `MESSAGES_UPSERT` is currently enabled/enregistered in Evolution instance (WP-001 blocked on live verification — not performed).
- Whether multiple users/agents have WhatsApp page open concurrently (would explain volume without loop).
- Whether any browser-level retry / service-worker behavior contributes (not inspected; no evidence found in repo).
- Whether `IMAP` sync frequency or failure-retry behavior contributes (not fully expanded in audit; not flagged as high-volume suspect from grep).

---

## OWNER ACTIONS REQUIRED

1. **Confirm domain verification status** for `dirtyhanddesigns.com` with Resend (or confirm failure) before declaring email fix; do NOT switch to Brevo solely without verification.
2. **Confirm WP-001 verification steps** (MESSAGES_UPSERT, webhook POST evidence, `lastMessageAt`) — do NOT reconnect/recreate Evolution instance until evidence collected; maintain `WP-001-whatsapp-fresh` branch.
3. **Confirm whether WhatsApp page is open across multiple users/agents** to explain load; consider reducing `loadChats` interval or using event-driven updates.
4. **Approve password-reset redesign** (Supabase recovery link / expiring token) — design review needed; do NOT implement without approval (security + compatibility with existing Supabase Auth).
5. **If Vercel route-level data is needed:** request Vercel analytics/log access or confirm via external monitoring; not produced in this audit.
6. **No production deploy of fixes requested in this audit.** All proposed changes listed for future planning; none applied.

---

## APPLICATION CODE CHANGED: NO
PRODUCTION DEPLOYED: NO
PRODUCTION CONFIG MUTATED: NO
EVOLUTION MUTATED: NO
EMAIL PROVIDER MUTATED: NO
VERCEL PLAN CHANGED: NO
SUPABASE MUTATED: NO
WP-001 BRANCH/BRANCH EVIDENCE MUTATED: NO

### Files changed in this audit (only documentation / audit packet)
- Created: `docs/work-packets/active/WP-OPS-STABILIZATION.md` (new audit packet)
- No modifications to `src/`, `api/`, `vercel.json`, `.env*`, `docs/work-packets/active/WP-001-whatsapp-webhook-failure.md`, `WP-001-whatsapp-fresh` branch, or any production file.

---

## REPORT ITEMS (from instruction §8 / §10)

1. Authoritative origin/master SHA: `d76e0dbe11eefe0547582e80b751a0da47853d38`
2. Audit branch: `WP-OPS-STABILIZATION` (pushed)
3. Remote commit SHA: `ca8e9125b5a67398cd030c6d641ac4081afbc85a`
4. Exact files changed: `docs/work-packets/active/WP-OPS-STABILIZATION.md` only
5. Vercel top request-volume suspects: WhatsApp `loadChats` (30s, 2,880/day/tab), Sidebar unread (60s, 1,440/day), Auth refresh (~60s, ~1,440/day), WhatsApp verify (self-terminating 1s), Vercel cron (1/day)
6. Runaway loop proven: NO (exit conditions present; no unbounded loops found)
7. Email failure classification: NOT PROVEN (suspected domain verification; no production log access; `RESEND FAILURE ROOT CAUSE NOT PROVEN`)
8. Domain verification status: `RESEND DOMAIN VERIFICATION NOT PROVEN`
9. Resend / Brevo / SMTP / Supabase Auth recommendation: Provider abstraction + Supabase Auth recovery for reset; Brevo as alternative transactional if domain verified; do not recommend based on price alone
10. WP-001 current conclusion: Branch preserved; evidence SHA present; diagnosis complete leading hypothesis Layer B + C; reconnect NOT performed; MESSAGES_UPSERT/webhook POST evidence pending live verification
11. WhatsApp related to Vercel usage: Partial (open tabs cause polling load) — not a root-cause relationship; no evidence failure causes overload
12. QA verdict: PASS
13. Security verdict: PASS
14. Owner actions needed: Confirm domain verification; confirm WP-001 live verification; check multi-tab usage; approve reset redesign; request Vercel analytics if needed
15. Zero production mutation confirmed: YES (explicit confirmations above)

FOLLOPS OPERATIONAL AUDIT EVIDENCE COMPLETE — PA REVIEW REQUIRED
