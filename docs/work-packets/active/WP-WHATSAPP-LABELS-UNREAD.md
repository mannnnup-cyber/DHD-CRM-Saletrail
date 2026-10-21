# WP-WHATSAPP-LABELS-UNREAD

Status: Review. Owner: integration implementation specialist; independent QA and security required.

## Objective and plan
1. Verify tagged Evolution 2.3.7 label contracts with read-only live requests.
2. Show existing phone label definitions in one compact menu, preserving provider IDs, duplicate names and original color codes. Do not create a second CRM label system.
3. Report the missing association readback honestly. Do not offer misleading shared filters, assignment chips or unverified writes.
4. Add authenticated owner/manager-only unread summary and seen-message operations using modern SUPABASE_SECRET_KEY, fresh active canonical identity and service-only SQL functions.
5. Persist exact displayed inbound message IDs, rather than a client clock watermark. New and delayed arrivals remain unread; reading is per CRM user and sends no WhatsApp read receipts.
6. Prepare a scoped migration, run synthetic tests/type-check/build, obtain independent reviews. No hosted migration, deployment, merge or push in this packet.

## Verified capability and limitation
Live GET /label/findLabels/follops-whatsapp: 200, nine definitions; fields id,name,color,predefinedId. Read-only POST /chat/findChats/follops-whatsapp: 200, 817 chat projections; no labels field. No customer values retained in this report.
Official tagged source: https://github.com/EvolutionAPI/evolution-api/blob/2.3.7/src/api/routes/label.router.ts and src/api/dto/label.dto.ts expose GET /label/findLabels/:instance and POST /label/handleLabel/:instance ({number,labelId,action:add|remove}). Baileys service persists internal Chat.labels but findChats omits it. Label creation/rename/delete are not exposed by this router. Write operations were NOT tested or invoked.
Full shared assignments, chips and filter are BLOCKED pending a bounded readback contract/provider patch and independent compatibility testing. This packet does not patch or redeploy Evolution.

## Safety and permissions
New actions require active owner/manager, verified server actor, modern secret only. Reps get an explicit unavailable notice; existing chats/status/assignment remain intact. New tables/functions have RLS, no browser grants, service-role access only. No existing table alterations, provider webhook changes, phone label merges/deletions, outgoing messages or credential changes. BrightBean migration remains paused. All existing stored inbound messages initially count as unread until opened; this is CRM-only state, not historical phone read state.

## Baseline and impact
Authoritative root: C:/Users/Administrator/DHD-CRM-Saletrail. Isolated branch feat/whatsapp-labels-unread, worktree work/whatsapp-labels. Refreshed origin/master b6f8dbcc9d9853d61e706d02ad43633ce164422c; clean baseline. Existing worktrees untouched.
GitNexus WhatsApp impact LOW, zero indexed upstream callers/processes. Handler graph is stale/incomplete (context incorrectly reports line7-296 versus actual147-2900); do not treat missing edges as complete safety evidence. Manually review early dispatch and restrict changes to new action dispatch, message status projection, and WhatsApp UI read indicators. Companion, existing provider sends and webhooks unchanged.

## Verification and rollout
Synthetic API/auth/provider contract tests, receipt SQL race/idempotency/grants checks where runtime permits, UI helper tests, type-check and production build. GitNexus detect_changes unavailable: inspect git diff/status before commit. Hosted migration requires separate reviewed backup/safeguard; UI must clearly show unavailable until migration installed, never false zero unread. Rollback: revert feature commit; additive receipt objects can remain unused without affecting CRM or provider.

## Implementation report (2026-10-21)
- New scoped backend dispatcher, readonly label catalog, per-person exact message receipts and unavailable-state UI implemented. Historical badges capped at 99+, stored count unchanged.
- Prepared migration created by Supabase CLI 2.121.0; one table/two RPCs. It remains unapplied. Two empty CLI retry artifacts were removed.
- Independent security review: PASS; modern-secret/fresh active owner/manager boundary, fixed server actor/providerinstance, JSON/bounds/rate limit, RLS/grant/invoker checks.
- Local executable PGlite migration test: PASS (actor isolation; exact counts; idempotent receipt inserts; delayed/new arrivals; wrong chat/outbound/other provider denial; rep/anon/authenticated denial; existing messages unchanged).
- API/helper unit tests:15/15 PASS. Initial invocation with only maxWorkers conflicted with Vitest default minWorkers; corrected command uses --minWorkers=1 --maxWorkers=1.
- Independent type-check and production Vite build: PASS; targeted type-check after hardening: PASS.
- Synthetic React DOM UI tests: 3/3 PASS (one read-only catalog with duplicate-name IDs; capped unread and exact inbound IDs/no phone receipts; unknown delivery status; migration-unavailable state).
- Limits: no hosted migration/security/behavior test; no actual outgoing/label writes; shared associations/filter/chips blocked; unread scoped to first 500 loaded chats and most recent 1000 loaded messages per conversation. Older history remains unread rather than silently marked read. CRM-only loaded-message state is not phone read receipt or proof of viewport viewing.
- Legacy public WhatsApp actions and unsigned webhook remain separate known risks; new scoped controls do not widen those boundaries.
- First follow-up packet: expose/test authenticated bounded provider Chat.labels projection with stable IDs and initial history + phone change coverage; reconcile actual readback before any assignmentwrites. Do not infer assignment from HTTP write acknowledgement.

## Independent review verdicts
QA: PASS for scoped local implementation (15 API/helper tests, 3 React UI tests, executable SQL harness, type-check and production build). Security: PASS with hosted behavior unverified and legacy route/webhook risks explicitly unchanged. Scope verified with git diff/status; GitNexus detect_changes was unavailable. Ready for owner review of the additive migration and separate provider-association follow-up. Not deployed.
