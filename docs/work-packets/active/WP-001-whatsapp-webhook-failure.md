# WP-001 â Diagnose Recurring WhatsApp Inbound Webhook Failure

## Metadata

- **Work Packet ID:** `WP-001`
- **Title:** Diagnose Recurring WhatsApp Inbound Webhook Failure
- **Status:** `Review` (NOT Done  blocked on live verification; QA verdict NEEDS-EVIDENCE; Security PASS + ESCALATE pre-existing webhook gap)
- **Priority:** `P0`
- **Owner:** Principal Architect / DHD
- **Assigned Agent(s):** `follops-integrations` (delegated by `follops-lead`); QA mandatory; Security mandatory for any implementation because this is a public webhook/integration path
- **Dependencies:** None
- **Branch/Worktree:** `WP-001-whatsapp` (from master @ `981d03a`)
- **Delegated:** 2026-09-11 by `follops-lead`

## Objective

Determine, with evidence, why FollOps has stopped receiving inbound WhatsApp messages even though the Evolution/WhatsApp connection is reported as connected. Restore reliable inbound delivery only after the failure layer/root cause is identified, and define the permanent self-healing/restart-resilience fix if appropriate.

This packet is diagnosis-first. Do not make speculative production changes merely to make the warning disappear.

## Business Background

WhatsApp is an active DHD customer communication channel. Missing inbound messages can cause missed customer requests and lost sales opportunities. The failure has occurred more than once, so manual reconnection alone is not an acceptable long-term reliability strategy.

## Current State / Incident Evidence

Known facts supplied by the owner and previously verified in the repository:

- FollOps WhatsApp UI reports the WhatsApp/Evolution instance as **Connected**.
- The UI warning reported approximately **150 hours with no messages received**.
- The owner used the orange **Reconnect** action, but the stale inbound-message warning remained.
- This is a recurring incident; webhook delivery has previously appeared to stop after server/container restart.
- The UI's connection state and inbound-webhook freshness are separate health dimensions; `Connected` does not prove webhook delivery is healthy.
- The reconnect flow currently attempts webhook configuration and then missed-message synchronization.
- The stale-hours warning is based on last actual inbound-message activity; re-registering a webhook by itself does not prove a new callback was delivered.
- Known pre-existing security concern: `api/whatsapp.ts` is a public webhook receiver and webhook authentication/signature handling requires Security review. Do not broaden this incident into unrelated security remediation unless necessary to safely fix the diagnosed failure.

## Diagnostic Path

Trace the complete inbound path and identify the exact failure layer:

`WhatsApp â Evolution instance â Evolution receives message â Evolution webhook registration/events â public FollOps /api/whatsapp callback â event/payload parser â Supabase whatsapp_messages/write path â API/UI refresh`

Classify the failure as one or more of:

- **A â Session/provider:** WhatsApp/Evolution is not actually receiving the inbound message despite reported connection.
- **B â Webhook registration:** Evolution receives it but webhook is absent, disabled, stale, or missing required events.
- **C â Callback delivery:** Evolution attempts callback to wrong/unreachable URL or receives non-success HTTP response.
- **D â FollOps webhook handler:** callback reaches FollOps but event/payload is rejected, misclassified, or fails parsing.
- **E â Persistence:** payload parses but Supabase/database write fails.
- **F â Presentation:** message is stored but FollOps API/UI does not display it.

## Scope

### In Scope

- [ ] Inspect current `api/whatsapp.ts`, WhatsApp UI/reconnect flow, Evolution integration code, relevant context docs, and current provider contract/version used by the project.
- [ ] Use GitNexus impact/context tooling where available before modifying symbols; diagnosis may use read-only exploration first.
- [ ] Verify the Evolution instance's actual connection state without disconnecting/recreating it.
- [ ] Query/inspect the **actual currently registered webhook configuration** for the active Evolution instance without exposing credentials.
- [ ] Verify callback URL, enabled state, configured events, especially `MESSAGES_UPSERT`, and relevant Evolution webhook options/version semantics.
- [ ] Compare current code's set/get webhook endpoint paths and payload shape with the Evolution API version actually running/documented for this deployment.
- [ ] Verify the live FollOps `/api/whatsapp` callback endpoint is externally reachable.
- [ ] Correlate a fresh controlled inbound test message with Evolution/provider state, FollOps/Vercel runtime evidence, and database state where access is available.
- [ ] Check whether missed-message synchronization can see/recover the controlled test message directly from Evolution.
- [ ] Identify the root cause/failure layer with evidence before implementing a permanent change.
- [ ] If the root cause is safely fixable within this packet, implement the smallest safe fix, then QA + Security review it.
- [ ] If a robust fix requires broader architecture/security/production changes, stop after diagnosis and propose a follow-up work packet rather than expanding scope.
- [ ] Assess whether automatic webhook health verification/re-registration after Evolution restart is warranted as a follow-up reliability feature.

### Out of Scope

- [ ] Deleting/recreating the Evolution instance.
- [ ] Disconnecting the WhatsApp number or rescanning QR unless a separately approved packet is created after evidence proves it is necessary.
- [ ] Credential rotation.
- [ ] Disabling legacy `SUPABASE_SERVICE_ROLE_KEY` (open deferred P0; unrelated to this incident).
- [ ] RLS mutation or production DB policy changes.
- [ ] Git history rewrite.
- [ ] Broad authentication redesign.
- [ ] Unrelated WooCommerce, Resend, BrightBean, YouTube, or cron remediation.

## Functional Requirements

1. Diagnosis must distinguish WhatsApp/Evolution connection health from webhook-delivery health.
2. The actual Evolution webhook registration must be inspected; do not infer it solely from FollOps UI state.
3. A fresh controlled inbound message must be traced as far through the pipeline as evidence permits.
4. Runtime/database evidence must establish the first layer at which the message disappears or fails.
5. If a code/configuration fix is implemented, missed messages should be recoverable through the existing sync mechanism where supported.
6. The final report must explicitly state the root cause or the exact remaining diagnostic required if root cause cannot yet be proven.
7. Do not claim recovery based solely on successful webhook registration; prove delivery with a real inbound message and persistence/UI verification.

## UX Requirements

- [ ] Do not change the UI merely to suppress the stale-message warning.
- [ ] If UI behavior is found misleading (for example, reconnect visually appearing successful without proving callback delivery), document it for a follow-up or include only a minimal correction if directly necessary and in scope.

## Technical Constraints

- [ ] Preserve the current route's approved authentication/security contract unless an explicit change is justified by the root cause and reviewed by Security.
- [ ] No browser-side direct Supabase access.
- [ ] Evolution settings continue to follow the repository's established settings-source precedence/contract.
- [ ] Do not expose API keys, tokens, passwords, webhook secrets, session material, phone-auth secrets, or private customer message content in logs/reports/commits.
- [ ] Use redacted identifiers/timestamps for diagnostic evidence where possible.
- [ ] Do not assume Evolution endpoint paths/payload formats; verify against the actual running/current version and existing implementation.
- [ ] Make the smallest safe change after diagnosis.

## Security Constraints

- [ ] **Security review mandatory** for any implementation because `api/whatsapp.ts` is a public webhook/integration endpoint.
- [ ] No credential rotation without explicit owner authorization.
- [ ] No RLS mutation without explicit approved scope, Security review, and owner authorization where required.
- [ ] Do not disable the deferred legacy Supabase service-role key.
- [ ] Never paste or commit secrets during provider/runtime inspection.
- [ ] Do not weaken webhook validation or introduce fail-open behavior.
- [ ] If existing missing webhook authentication/signature validation is encountered, record it as a security finding; do not silently redesign the webhook contract outside this incident's approved scope.

## Expected Files / Modules

Likely inspection scope (not authorization to edit all files):

- `api/whatsapp.ts` â Evolution actions, webhook receiver, parsing, persistence/sync behavior
- `src/pages/WhatsApp.tsx` â connection/webhook health display, reconnect and sync flows
- `docs/context/INTEGRATIONS.md` â Evolution/WhatsApp integration state
- `docs/context/ARCHITECTURE.md` â route/data-flow constraints
- `docs/context/SECURITY.md` â webhook/security baseline and open items
- Relevant Evolution helper/config modules discovered through `FILE_MAP.md`/GitNexus

## Testing Requirements

### Diagnosis / Recovery

- [ ] Record pre-test connection state and webhook configuration without secrets.
- [ ] Send/identify one fresh controlled inbound WhatsApp test message from a separate number.
- [ ] Confirm whether Evolution itself sees that message.
- [ ] Confirm whether Evolution attempts/delivers the webhook callback.
- [ ] Confirm whether FollOps receives the callback and returns a successful/expected HTTP response.
- [ ] Confirm whether the message is persisted.
- [ ] Confirm whether it appears in FollOps after refresh/sync.
- [ ] If sync recovery is used, distinguish recovered-by-poll/sync from delivered-by-webhook.

### If Code Changes Are Made

- [ ] `npm run build` passes.
- [ ] Type check passes.
- [ ] Relevant WhatsApp/integration tests or controlled smoke tests pass.
- [ ] Existing outbound WhatsApp behavior is not regressed.
- [ ] Existing companion/contact behavior touched by the handler is not regressed where applicable.
- [ ] QA independently verifies acceptance criteria.
- [ ] Security independently reviews the webhook/integration diff.
- [ ] Verify live behavior only after an explicitly approved deployment path; Lead must not deploy autonomously.

## Acceptance Criteria

1. The first failing layer AâF is identified with concrete evidence, or the packet is marked Blocked with the exact missing diagnostic/evidence required.
2. The actual Evolution webhook configuration and required event registration are verified against the running/current provider contract.
3. A real fresh inbound test message is used to prove whether webhook delivery is functioning; stale-hours UI state alone is not used as proof.
4. No Evolution instance deletion/recreation, QR reset, credential rotation, RLS mutation, Git history rewrite, or unrelated security change occurs.
5. If a fix is implemented, build/type checks pass and QA approves it.
6. Security reviews any implementation affecting the public WhatsApp webhook/integration path.
7. Final report distinguishes **incident recovery** from **permanent prevention** and recommends a follow-up self-healing/restart-resilience packet if needed.
8. No regressions in existing WhatsApp outbound/sync paths.

## Rollback

If code changes are made:

- [ ] Revert only the WP-001 implementation commit(s)/branch; do not rewrite history.
- [ ] Restore the previous known-good webhook behavior/configuration only if the exact prior state was captured and restoration is safe.
- [ ] Do not use instance deletion/recreation as rollback.

## Definition of Done

- [ ] Root cause/failure layer proven, or exact blocker documented.
- [ ] Actual webhook configuration/provider contract verified.
- [ ] Controlled inbound test traced.
- [ ] Any implementation is minimal and within scope.
- [ ] Build passes if code changed.
- [ ] Type checks pass if code changed.
- [ ] QA review complete.
- [ ] Security review complete for any implementation.
- [ ] Documentation updated where behavior/architecture/integration state changed.
- [ ] CHANGELOG/FILE_MAP/TASK_BOARD updated if applicable.
- [ ] Permanent-prevention follow-up identified if recovery alone does not eliminate recurrence.

## Implementation Report

(To be filled by implementation agent upon completion)

- **Work Packet:** WP-001
- **Branch/Worktree:**
- **Files Changed:**
- **Summary:**
- **Root Cause / Failure Layer:**
- **Diagnostic Evidence:**
- **Recovery Performed:**
- **Permanent Prevention Recommendation:**
- **Tests Executed:**
- **Build Result:**
- **Known Limitations:**
- **Assumptions:**
- **Unresolved Questions:**
- **Commit SHA:**
- **QA Review Required:** Yes
- **Security Review Required:** Yes for any implementation

## QA Review

(To be filled by `follops-qa`.)

## Security Review

(To be filled by `follops-security` for any implementation/security-sensitive finding.)

--- LEAD FINAL RECORD (2026-09-11) ---
Status: Review (NOT Done â blocked on live verification; QA verdict NEEDS-EVIDENCE; Security PASS + ESCALATE pre-existing webhook gap)
Work Packet: WP-001 â Diagnose Recurring WhatsApp Inbound Webhook Failure
Branch/Worktree: WP-001-whatsapp (from master @ 981d03a; branch pushed to origin; no master merge)

--- LEAD FINAL RECORD (2026-09-11) ---
Status: Review (NOT Done - blocked on live verification; QA verdict NEEDS-EVIDENCE; Security PASS + ESCALATE pre-existing webhook gap)
Work Packet: WP-001 - Diagnose Recurring WhatsApp Inbound Webhook Failure
Branch/Worktree: WP-001-whatsapp (from master @ 981d03a; branch pushed to origin; no master merge; master preserved)
Implementation Report: Diagnosis-only; zero production code edited (api/whatsapp.ts, WhatsApp.tsx, any source unchanged). No code mutation in master or worktree production paths. WP-001-whatsapp/docs/diagnosis-findings.md produced. Build PASS (vite v7.2.4, exit 0; no regression). Root Cause Classification: Layer B (Webhook Registration - volatile after Evolution container/restart) + Layer C (Callback Delivery - no persistence verification). Evidence: static/code-analysis only (api/whatsapp.ts lines 164-555 webhook receiver, 469-507 webhookInfo, 509-555 setWebhook, 410-467 status; WhatsApp.tsx reconnect/gap banner lines 1464-1484). No live test performed: live webhookInfo result not saved; Evolution restart/re-registration not executed; live POST /api/whatsapp with controlled payload not confirmed; Vercel delivery log not captured; DB whatsapp_messages persistence not verified; syncEvolutionMessages recovery not tested. Root cause NOT fully proven by runtime evidence.
QA Review (follops-qa - verdict NEEDS-EVIDENCE): PASS for diagnosis work; FAIL to claim fully proven root cause. Acceptance criteria NOT met: AC 2 (live webhook config missing), AC 3 (fresh inbound message not traced), AC 6 (root cause not proven with evidence). Exact missing evidence: (a) live webhookInfo after reconnect; (b) controlled inbound WhatsApp message with Evolution receipt proof; (c) Vercel POST /api/whatsapp log with 200 response; (d) DB persistence query (whatsapp_messages insert); (e) UI refresh; (f) syncEvolutionMessages recovery. Block code fix until all present.
Security Review (follops-security - verdict PASS): PASS - no code changed; no new secrets; no auth mutation; no RLS mutation; legacy SUPABASE_SERVICE_ROLE_KEY preserved (deferred P0); no webhook contract weakened; no fail-open; no credential exposed. ESCALATE (pre-existing, not worsened): public /api/whatsapp endpoint has NO webhook signature/auth validation (line 164-402; no HMAC/signature check; attacker with endpoint URL can POST fake payload). P0 open per docs/context/SECURITY.md + INTEGRATIONS.md. Must NOT be silently redesigned outside approved scope. Requires explicit owner authorization for any webhook-auth mutation.
Evidence Classification: Code-analysis / static inspection only. Explicit missing live evidence listed above. No production database or live Evolution API access shown.
Limitations: No Evolution container restart/re-registration; no Vercel production log; no DB query results; no controlled test message; no webhookInfo live response; no syncEvolutionMessages test; Evolution API version/container tag not verified at runtime.
Root Cause: B + C (classification only; not fully proven without live evidence per AC 6). Layer A (session): NOT root cause. Layer D (handler): NOT cause. Layer E (persistence): NOT testable. Layer F (presentation): NOT cause.
Next Action (Blocked - status Review, NOT Done): Before any fix/merge: (1) Live Evolution webhookInfo after reconnect - save result; (2) Send controlled inbound message from separate number - capture Vercel POST + DB insert; (3) Confirm UI refresh; (4) Confirm syncEvolutionMessages recovery; (5) Verify build/type checks if minimal fix approved after evidence. Once proven, propose WP-002. No code edit / deployment / master merge until verification passes QA + Security (if webhook/auth change, Security must clear explicitly).
Proposed Follow-up WP-002 (separate, not started): Permanent webhook self-healing/restart-resilience - auto webhook verification post-reconnect + periodic health poll (e.g., 5 min) + sync trigger after restart + webhookInfo verification after autoConfigureWebhook. Requires its own work packet + QA + Security review (if endpoint/auth changed). NOT part of WP-001.
Constraints Confirmed: No production code edited (verified: only docs/diagnosis-findings.md + docs/work-packets/active/ record); no security mutation; no RLS mutation; no credential rotation; legacy service_role NOT disabled (deferred P0 preserved); no Git history rewrite; no duplicate WP-001 in active/; no overlapping active work; master @ 981d03a preserved; branch WP-001-whatsapp separate; no deployment; no production data deletion; no live test falsely claimed.
# Status update
Status: Blocked
QA: NEEDS-EVIDENCE
Security: PASS + ESCALATE
Evidence: docs/diagnosis-findings.md

## Live Verification Attempt (2026-09-11)

### Setup
- Work Packet: WP-001
- Branch/Worktree: WP-001-whatsapp @ c5a9660
- Owner confirms real inbound WhatsApp traffic is arriving on the DHD sales number (phone redacted per constraints).
- Layer A (customer message arrival at WhatsApp number) treated HEALTHY per owner confirmation.
- No customer message content or phone numbers recorded; timestamps/classification only.

### Read-only diagnostics attempted
1. Evolution API webhook endpoint (`/webhook/find/{instanceName}`) returns HTTP 401 without apikey (expected). Webhook config not retrievable from this environment without secret.
2. Public callback endpoint `POST /api/whatsapp` reachable per code analysis (lines 164-402). No live POST observed from this environment.
3. Webhook registration events (from source): `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`, `CALL` (lines 509-555).
4. `syncEvolutionMessages` code path exists (lines 1853-2059) and can upsert missing messages into DB; execution requires authenticated session or apikey (secret).

### First unobservable layer
**Layer B (Webhook registration) / Layer C (Callback delivery)** — cannot observe live webhook config or POST attempts from this environment without:
- (a) Evolution API auth (apikey) — secret exposure prohibited per constraints, OR
- (b) Vercel function logs showing recent `POST /api/whatsapp` attempts and HTTP status, OR
- (c) Owner-provided redacted webhook config (configured, url domain, events, lastMessageAt).

### Required owner action (exact)
Fetch live webhook configuration for instance `dhd-crm-wa` via Evolution UI/API (authenticated) and provide the following (no secrets, redacted as needed):
- `configured`: true/false
- `url`: redacted domain only (e.g. `https://*.vercel.app/api/whatsapp`)
- `events`: list (e.g. `MESSAGES_UPSERT`, …)
- `lastMessageAt`: timestamp of latest inbound message persisted in DB
- Confirm from Vercel dashboard whether recent `POST /api/whatsapp` invocations exist and their HTTP status codes (e.g. 200 vs 4xx/5xx) with timestamps.
- Optionally, run **Sync Messages** from WhatsApp UI and report count of recovered messages (no content).

### Constraints preserved
- No production code edited
- No Evolution instance deletion/recreation/disconnect/QR reset
- No credential rotation
- No RLS mutation
- No legacy `SUPABASE_SERVICE_ROLE_KEY` disable (deferred P0 preserved)
- No master merge; no deploy
- No customer message content or phone numbers exposed

### Status
WP-001 BLOCKED AT LAYER B — OWNER ACTION REQUIRED: Provide redacted live webhook config + Vercel POST logs as specified above.
