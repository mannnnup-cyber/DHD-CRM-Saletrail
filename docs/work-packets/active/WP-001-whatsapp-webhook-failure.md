# WP-001 — Diagnose Recurring WhatsApp Inbound Webhook Failure

## Metadata

- **Work Packet ID:** `WP-001`
- **Title:** Diagnose Recurring WhatsApp Inbound Webhook Failure
- **Status:** `Planned`
- **Priority:** `P0`
- **Owner:** Principal Architect / DHD
- **Assigned Agent(s):** `follops-lead` to delegate primarily to `follops-integrations`; QA mandatory; Security mandatory for any implementation because this is a public webhook/integration path
- **Dependencies:** None

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

`WhatsApp → Evolution instance → Evolution receives message → Evolution webhook registration/events → public FollOps /api/whatsapp callback → event/payload parser → Supabase whatsapp_messages/write path → API/UI refresh`

Classify the failure as one or more of:

- **A — Session/provider:** WhatsApp/Evolution is not actually receiving the inbound message despite reported connection.
- **B — Webhook registration:** Evolution receives it but webhook is absent, disabled, stale, or missing required events.
- **C — Callback delivery:** Evolution attempts callback to wrong/unreachable URL or receives non-success HTTP response.
- **D — FollOps webhook handler:** callback reaches FollOps but event/payload is rejected, misclassified, or fails parsing.
- **E — Persistence:** payload parses but Supabase/database write fails.
- **F — Presentation:** message is stored but FollOps API/UI does not display it.

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

- `api/whatsapp.ts` — Evolution actions, webhook receiver, parsing, persistence/sync behavior
- `src/pages/WhatsApp.tsx` — connection/webhook health display, reconnect and sync flows
- `docs/context/INTEGRATIONS.md` — Evolution/WhatsApp integration state
- `docs/context/ARCHITECTURE.md` — route/data-flow constraints
- `docs/context/SECURITY.md` — webhook/security baseline and open items
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

1. The first failing layer A–F is identified with concrete evidence, or the packet is marked Blocked with the exact missing diagnostic/evidence required.
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
