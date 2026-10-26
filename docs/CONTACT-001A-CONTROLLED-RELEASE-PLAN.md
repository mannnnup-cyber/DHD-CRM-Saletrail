# CONTACT-001A — controlled release preparation

Prepared 2026-10-25 (America/Bogota). **PLAN ONLY — no permission to execute a release, push, hosted fixture write, migration or configuration change.**

## 1. Candidate and adopted policy

Existing branch/worktree: feat/contact-001a-secure-review in work/contact-001a.
Candidate documentation HEAD: **8c76b7589115de5b09e8556c12be4badc19812c1**.
Tested application commit: **84bcbfbd09381706217f8929751d222ceb815685**.
Read-only verification today: starting worktree clean; application/API/tests/package/config/migration source unchanged since the tested application commit. Current architect-review patch reverse-check passed against HEAD. Prior independent evidence: **460/460 tests,25 files,99.04s; TypeScript PASS; production build PASS,2,784 modules,1m24s; scoped security PASS**. No tests were rerun for this documentation-only preparation. A later implementation commit must receive fresh complete verification and a new frozen SHA.

Owner policy is now controlling, not an open choice:

- Shared email/phone values are legitimate; identifier equality never proves the same person. No automatic reuse, merge, overwrite or relationship transfer.
- Owners/managers may access authorized business history.
- Reps may access assigned contacts and only their own properly attributed notes. Other staff notes and restricted history must remain hidden in API responses, counts, search, comparison and UI.
- Existing customer IDs, records and relationships must be preserved.

### Local policy alignment implemented — verification required

The owner authorized final local corrections after this plan was prepared. Shared identifier creation/correction now uses explicit owner/manager review, acknowledgment and reason, a signed three-minute actor/purpose/target/proposal/original/candidate-state grant, and a durable single-use UUID claim in the existing interactions primary key. All matches must fit a complete review of at most 20; overflow fails closed. Matching contacts and relationships are never reused, merged or modified by the decision. Identity correction retains the seven-field conditional update.

A protected NOTE with source contact-shared-review records the intent before mutation; contact_id stays NULL to avoid contact deletion cascades. Outcome finalization is checked. Failed intent prevents the save; failed or lost outcome returns uncertainty and blocks automatic UI retry. This is a recoverable write-ahead audit, not an atomic save-and-audit transaction. An uncertain operation must be reconciled by its operation ID before another attempt.

Rep list/detail/candidates/comparison now use a basic-field allowlist and properly attributed own-note queries only. Financial/provenance/other-note/channel/relationship history is not queried or returned. Organization endpoints return explicit restricted/unavailable results without membership counts. Owner/manager business-history access remains. UI hides restricted sections instead of showing invented zeros. Both correction and manual creation preserve drafts through review/cancel and uncertain outcomes.

See docs/CONTACT-001A-FINAL-POLICY-CORRECTIONS.md for exact files, final independent test evidence and remaining limits. The earlier 460-test checkpoint above is historical and superseded only by the final correction verification report.

Residual limits still require release decisions: separate database statements cannot atomically fence candidate, role or assignment changes after the final check; ordinary no-match creation/retries lack general idempotency; distinct valid review grants intentionally can create separate contacts. The single-use claim prevents replay of one grant, not every repeated business request. Do not add global identifier uniqueness or silently reuse a contact. No new hosted schema object was introduced. Hosted acceptance and all subsequent release gates remain required.

## 2. Smallest deployment-trigger correction — approval A

Repository: mannnnup-cyber/DHD-CRM-Saletrail.
GitHub repository webhook: **641005278**, active, event push, private destination is the Vercel Deploy Hook for project **dhd-crm-saletrail** / prj_USKJsJQAVoYMosqbE19F6bre2nhK, team_oR9AcZvAU91AR7ralAlffIB3.
Prior direct Vercel UI inspection matched it to **GitHub CI**, fixed branch **master**. Production tracks master with automatic domain assignment. Historical deliveries from master and feature branches were accepted201/PENDING. Today's read-only hook check still shows active/push/the same project; last-response metadata was not returned, so it is not new deployment-execution evidence.

The feature branch already contains:

```json
"git": { "deploymentEnabled": { "feat/contact-001a-secure-review": false } }
```

Keep this exact-branch rule. It does not establish protection from the separate fixed-master Deploy Hook. Do not change it to a wildcard, globally disable GitHub integration, revoke the Vercel hook or guess a new hook URL.

**Smallest proposed change:** after verifying the native Vercel Git integration still handles master independently, deactivate **only** the redundant GitHub repository webhook. Leave its events, destination, secret, TLS verification and content type intact; leave the Vercel project, master mapping, native Git integration, environment variables, cron, domains and all other hooks unchanged.

Exact future API request, **NOT EXECUTED**:

```http
PATCH https://api.github.com/repos/mannnnup-cyber/DHD-CRM-Saletrail/hooks/641005278
Content-Type: application/json

{"active":false}
```

Prerequisites: privately record current hook configuration; inspect current native Git repository binding, production branch and recent deployment provenance through read-only Vercel access. Prior UI connection/history is supporting evidence, not proof that the hook is redundant today. If independent native-master deployment cannot be established, STOP; do not disable the only proven production path. A master-only workflow/receiver would require a separately reviewed workflow/secret design and is not the smallest change when native Git is already functional.

Expected impact after approval: feature pushes no longer invoke master through this repository hook; the exact feature rule also blocks its normal Git preview. Master native Git deployments and other branches' existing preview rules remain unchanged. This removes one master deployment trigger and possible duplicate builds; it is not literally unchanged trigger topology. External callers of the retained Vercel Deploy Hook remain possible and must be inventoried. Do not claim all possible deployment paths are disabled.

Post-change read-only check must show this hook inactive, native integration/master mapping unchanged, no other push-triggering deployment hooks/workflows, and the feature safeguard in the exact pushed tip. **Separate approval B** is then needed to push only the feature branch for review. Do not use a test push as the initial safeguard. Observe jobs for both the pushed SHA and master; any unexpected deployment is a stop condition. A future approved abort procedure may cancel only the newly identified task-triggered pending job; no such action is authorized now.

Trigger rollback, separately authorized: freeze all branch publication first; restore only this hook's recorded active state with PATCH {"active":true}. Do not ping/redeliver/fire it. Re-enabling restores the dangerous all-push behavior, so do not resume feature pushes until the owner accepts a corrected trigger design.

References: [Vercel Deploy Hooks](https://vercel.com/docs/deploy-hooks), [branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration), [GitHub push events](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push).

## 3. Exact hosted SQL and backup gate — approval C

Project: **vatsonbvjkyzxqrnderr**. File: **supabase/migrations/20261023205637_contact_review_view_security.sql**.
SHA256 verified today: **7d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7**.
Read-only hosted check today: three view options still NULL; definition fingerprints match the architect response; migration history entries0. It is UNAPPLIED.

Only approved forward SQL:

```sql
BEGIN;
ALTER VIEW public.enrichment_status SET (security_invoker = true);
ALTER VIEW public.org_members_all SET (security_invoker = true);
ALTER VIEW public.org_members_current SET (security_invoker = true);
COMMIT;
```

No table/column, customer row, grant, policy, role or unrelated migration change. Apply the exact file using its transaction, not a general migration push. The enrichment view is catalog-updatable/insertable; future validation must test denied synthetic writes as well as reads. Its broad owner-context exposure is not fixed by merely shipping new UI code.

**Actual hosted backup/restore is NOT VERIFIED.** Existing evidence verifies the recovery method only: a4,658-byte synthetic PG17.10 dump, SHA2561245c8a0a44d8b0c301f7bb4de0e36f1e173820ec3defc699694fd0d0ef76e82, restored locally and exercised forward/targeted rollback with its synthetic row preserved. Do not label it a CRM backup.

Before C can be executed, complete docs/CONTACT-001A-VIEW-MIGRATION-VALIDATION-PLAN.md: secure verified project PostgreSQL access, fresh logical dump of all relevant accessible CRM schema/data and permitted Auth data, relevant grants/roles without password disclosure, documented managed-schema/Storage/platform exclusions, private restricted storage outside Git, checksums/size/TOC, and an actual private disposable restore with schema/count/constraint/sequence/grant comparisons. Preserve required Storage object bytes separately; database metadata is not the files. Stop if relevant CRM recoverability cannot be demonstrated. This uses a Free-tier-compatible logical backup; a paid plan is not a prerequisite. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

Reconcile all view consumers before C, especially evolution_user: its existing grants do not bypass RLS, and under current no-policy base tables invoker reads are expected to return no rows. Service-role authorized server reads should retain their privileges. Any required consumer would lose access: STOP and seek a separate design, never add permissive grants/policies to make a test pass.

Targeted SQL rollback, **only after a separate security/compatibility decision and only if the recorded pre-state is NULL**:

```sql
BEGIN;
ALTER VIEW public.enrichment_status RESET (security_invoker);
ALTER VIEW public.org_members_all RESET (security_invoker);
ALTER VIEW public.org_members_current RESET (security_invoker);
COMMIT;
```

This restores known owner-context exposure. Prefer an approved roll-forward/consumer fix when possible; do not reset automatically on a generic error. It restores view options, not customer data. A full database restore is an emergency, separately approved recovery with write reconciliation, never a routine rollback over newer records. psql execution does not automatically record Supabase migration history; any ledger reconciliation needs explicit scope. Preserve all baseline definitions/grants and compare after recovery.

## 4. Hosted synthetic authorization preparation — approval D

These are **prepared, NOT EXECUTED** tests. Provisioning Auth users, assigning roles and inserting/cleaning fixtures are hosted writes and require separate explicit authorization. No invitation/reset email, WhatsApp send, WooCommerce sync, automation run, enrichment, merge or external provider call is allowed.

### Isolation and fixture manifest

- Prefer existing authorized owner/manager interactive sessions; do not copy their credentials. If temporary elevated identities are necessary, owner approval must explicitly cover that sensitive access and its expiry. Prepare RepA and RepB with matching Auth/canonical active profile/legacy users UUID+email; prepare a separate inactive fixture. Use example.test addresses and local private credentials, with no invitation email. Missing canonical/legacy agreement must deny access, not cause permission expansion.
- Use a unique C001A-REL-<run> marker in every synthetic contact's name. Prepare A/B assigned to RepA, C assigned to RepB and U unassigned; record exact generated UUIDs privately. No actual customer ID may enter the manifest. Emails use a run-specific example.test domain. Use none@<run>.example.test for hosted placeholder evidence; exact none@gmail.com was tested locally and must not be used to discover or contact a real mailbox.
- Prepare same/shared/family identifiers and different full-phone strings with equal last ten digits, plus missing/stale normalization fixtures. Phone strings are synthetic and never dialed. Prepare RepA-own source/version-attributed note, RepB note, unattributed legacy note and wrong-source/version notes on A. Prepare relationships only between captured synthetic contacts. Positive order-link fixtures require their own explicit child-write approval; otherwise keep positive linking tests local.
- Inspect triggers, cron/automation selectors and provider paths first. A name/tag is **not** an automation exclusion. Stop fixture creation unless fixtures cannot trigger real operations. Use a local candidate API connected to the exact hosted project with enforced provider egress denial/stubs for all non-Supabase transports. Missing provider environment variables alone are insufficient because settings can come from the database. Do not weaken production integration settings for a test.
- Prefer this frozen local API + hosted Supabase approach before deployment; passing it is hosted Auth/PostgREST evidence, not a production deployment check. Test app uses the new frozen SHA and only server-side privileged credentials; UI receives user sessions/public configuration. Record requests/status/assertion summaries without tokens, customer bodies or private note content. Owner list/search must filter the unique fixture marker to avoid collecting unrelated rows.

### Exact HTTP acceptance matrix

For each request use fresh sessions, and test missing token, invalid/expired token, inactive profile, owner, manager, assigned RepA and foreign/unassigned RepB. U is an unassigned contact, not an actor: explicitly assert neither RepA nor RepB may access U. The unassigned-rep case means a valid rep with no assignment to the target, not a new privileged role. Record the actual status and sanitized field/count assertions, not merely screenshots. Reps' expected contract below is the **new adopted policy after local alignment**, not proof that8c76b75 already passes.

| Request | Owner/manager | Assigned rep | Foreign/unassigned rep | No/invalid token; inactive |
| --- | --- | --- | --- | --- |
| GET /api/contacts?search=<fixture-marker> | Fixture business results | Assigned fixture identities/count only | Only own permitted fixtures; no hidden totals | 401;403 |
| GET /api/contacts?id=A | Authorized business history | Basic A + own proper notes only; no financial/channel/other-staff data | 404 | 401;403 |
| GET /api/contacts?action=duplicateCandidates&contactId=A | Permitted evidence/count | Assigned basic candidates only | 404 source; hidden candidates omitted | 401;403 |
| GET /api/contacts?action=compare&left=A&right=B | Authorized metadata; no message bodies in comparison | Assigned basic identities + own notes only; restricted counts/history absent | Any forbidden side404 before child queries | 401;403 |
| POST /api/contacts?action=editIdentity&id=A | Snapshot/CAS, explicit shared-save review; stale409 | 403 | 403 | 401;403 |
| POST /api/contacts?action=resolve | Deliberate distinct creation only; existing record never auto-selected | 403 | 403 | 401;403 |
| POST /api/contacts?action=addNote&id=A | Server-attributed synthetic note | Own attributed note only on assigned A | 404;no insertion | 401;403 |
| CRM organizations getOrganizations/getMembers | Authorized business relationships | Restricted/unavailable under adopted policy | No membership details/counts | 401;403 |
| CRM organizations linkContact/unlinkContact | Only approved synthetic endpoints | 403 | 403 | 401;403 |
| Contact searchOrders/linkOrder | Owner/manager only; CAS/no reassignment; synthetic positive test separately approved | 403 | 403 | 401;403 |
| mergeContacts/enrichLead/enrichContacts/previewEnrichment/migrate POST | 409 disabled; no mutation | 403 | 403 | 401;403 |
| CRM default/team/opportunities | Authorized business scope | Explicit denied/unavailable with no history leakage | Same | 401;403 |
| WooCommerce configured GET | Owner/manager only; configuration status without provider request | 403 | 403 | 401;403 |

Also test aliases findDuplicates/checkBeforeEnrich, guessed/malformed UUIDs, hidden matches/counts, both organization endpoints, invalid methods, body-forged actors, account switching, assignment drift, optional unavailable summaries and final fresh scope checks. Negative Woo read/sync auth/method requests must terminate before provider access; **never perform positive sync/test/orders/customers/products calls to the provider**. Essential authorization/schema errors stop acceptance; do not relabel them optional.

Positive note/correction/create/link tests are hosted synthetic mutations and cannot run under preparation-only approval. Capture A's seven original fields; competing correction1 succeeds and stale correction2 returns409 with draft intact. Shared-save tests must retain both distinct IDs and every unrelated relationship. Parallel creates/retries must meet the approved idempotency acceptance decision. Do not delete or merge a resulting duplicate to make a test pass.

After approved C, test anon/authenticated/service-role SQL/Data API behavior on the three views using synthetic records. Verify exact definitions/owners/dependencies/grants and CRM schema/data invariants unchanged; no allowing-policy additions. Test actual denied browser writes on enrichment_status. Do not use service-role success as proof of browser RLS.

## 5. Desktop/mobile acceptance preparation — approval E for hosted fixtures

Run the same frozen candidate at desktop1440x900 and mobile390x844, plus narrow320px/200% zoom and keyboard-only navigation. Use a local non-production UI/API with the approved hosted synthetic fixtures and enforced provider isolation. Non-contact screens/transports must be synthetic/stubbed where needed; never collect unrelated real inbox contents. No test shim or mock mode may ship in the production artifact. Tests are prepared only, not claimed passed here.

1. Search/list: filter the run marker; reset pagination on search; totals cover permitted contacts only; no rep financial/history fields in response or DOM. Fresh account switch clears cached PII.
2. Correct A to a shared email/phone: warning lists permitted matches and matching/conflicting fields, explains shared identifiers, never displays a probability score or selects another identity. Draft remains unchanged. Restricted matches yield generic guidance without hidden counts.
3. View: correct permitted contact opens, with original draft still available. Back/close retains it. Forged hidden URL gives a generic unavailable response, no PII flash.
4. Compare: side-by-side desktop/stacked mobile; long names/email/phone wrap; safe-area, close control and keyboard focus remain usable. Tab stays inside, Escape closes and focus returns. Closing/comparison does not save a draft. Old request/account/contact responses never paint into the new comparison.
5. Deliberate shared save: owner/manager explicitly chooses separate identity after review; snapshot submitted; only intended record changes, both IDs preserved, no child transfer. Rep has no correction control and direct requests403. A warning is not a forced merge or permanent prohibition.
6. Stale edit: two tabs load A; first saves, second receives409 and keeps its draft. Missing expected snapshot fails safely. Pending save disables competing edits; slow response or close never reports unconfirmed success.
7. History: owner/manager see permitted business history; RepA sees only their proper notes; other authors/legacy/wrong metadata and raw notes are absent from payload and UI. Unavailable history is not displayed as verified zero/empty. Comparison never exposes email/WhatsApp body or subject.
8. Corrected cellular history maps actual schema fields/case without inventing status. Rejected synthetic order link remains visibly unlinked. Optional failure fault injection stays local, not a hosted outage test.
9. Inbox, Contacts, organization and WooCommerce navigation/rendering regressions use safe synthetic transports. Do not click sync, send, call, publish, reconnect or test-provider buttons. Preserve customer IDs and integrations throughout.

## 6. Ordered release checklist and stop conditions

Every phase has a distinct execution approval. This document authorizes none of them.

| Order | Future action | Required evidence / STOP condition |
| --- | --- | --- |
| 0 | Local policy alignment and independent review | Shared identifiers truly save as distinct, rep own-note/basic-only policy passes API+UI tests; no B/C/D merge lifecycle; new full test/type/build/security PASS and frozen SHA. STOP on policy gaps. |
| 1 | Read-only release preflight | Exact repo/team/project/production mapping, all deployment triggers, source/patch/checksums, service credentials scope and consumer inventory. STOP on drift or unknown target. |
| 2 | Approval A: deactivate only hook641005278 | Native master Git path verified independently; private rollback copy; post-change inactive hook. STOP if production path cannot be preserved. No push yet. |
| 3 | Approval B: feature-only GitHub publication / PA review | Exact tip contains branch guard; no independent trigger; verify remote SHA and zero deployments for both feature/master. STOP on any unexpected job or altered SHA. Never merge as a review-only action. |
| 4 | Backup authorization and recovery verification | Actual hosted CRM logical backup, private storage/checksums/coverage and actual disposable restore PASS. STOP if only the synthetic recovery dump exists. |
| 5 | Approval D: isolated synthetic fixtures and pre-migration local-candidate/hosted-DB tests | Approved actor/UUID manifest, no real-operation automation exposure, real Auth/REST role results; captures no customer content. STOP on unauthorized data, provider traffic or mutation outside fixture IDs. |
| 6 | Approval C: exact three-view migration + synthetic validation | Approved checksum/transaction, compatible consumers, metadata invariants, role/DML checks and recovery ready. STOP on any SQL failure; do not improvise extra DDL or grant changes. |
| 7 | Final PA/owner production decision | Fresh QA/security, desktop/mobile acceptance, signed risk decisions, approved secure fallback artifact and deployment/abort operator. STOP if rollback would reopen unsafe merge/public contact access without explicit security decision. |
| 8 | Separate explicit production authorization: merge exact approved SHA into master | Merge itself triggers native production deployment; approval must cover both. One path only, hook still inactive; no unrelated commits/migrations. STOP on different build source or configuration. |
| 9 | Approved post-deployment smoke and observation | Verify deployed SHA/health and synthetic role/UI results, including own-note privacy and shared save; observe errors/provider health without sending messages. STOP and contain on privacy breach, stale overwrite or unintended operation. |
| 10 | Approved scoped fixture cleanup and closeout | Preserve required audit evidence; exact IDs/ownership/tags/dependencies checked. No broad pattern deletion, real-record deletion, reassignment or assumed cascades. If cleanup could delete audit/unknown children, retain the fixture and escalate. |

Application rollback: before step8, identify a previously tested secure application artifact that remains compatible with the invoker views. The old production baseline contains the legacy contact authorization/merge gaps; blindly redeploying it is not an acceptable default. If no secure fallback exists, prepare/test one or obtain a specific owner-approved containment/roll-forward plan **before release**. During an incident preserve customer writes/relationships and existing channel connections; do not reverse merges, restore an old database over new records, reconnect accounts or run unrelated migrations. Version rollback is separately authorized and verified by SHA; run the same role/privacy smoke afterward. Database view rollback and hook rollback are independent decisions, never bundled silently into application rollback.

No actual hosted cleanup SQL is prepared as a blanket DELETE script. Future approved cleanup uses a private exact-ID manifest and rechecks every relationship. Deactivation/removal of temporary Auth/legacy/profile users needs its own approved procedure so legacy FK effects and audit retention are understood.

## 7. Owner approvals to request next

1. Bounded local policy alignment was separately authorized and is complete locally: 498/498 tests, TypeScript, production build and independent scoped QA/security PASS. See the final-policy report; production release is still unauthorized.
2. A: the single inactive-hook PATCH after native-master preservation is verified; B: subsequent feature-only push for independent review.
3. Actual private hosted backup/restore work; D: precisely scoped synthetic Auth/fixture writes and cleanup, with provider isolation.
4. C: exact forward SQL above, separately approved targeted rollback if needed; no other hosted SQL.
5. E/final release: acceptance execution, exact merge/deployment SHA, safe fallback and post-release smoke only after all preceding gates pass.

No production authorization is requested implicitly through a test PASS, a documentation commit, a branch push or a migration approval. Current preparation changed documents only; it did not push, merge, alter webhook/Vercel settings, apply SQL, deploy, create fixtures or modify customer records.

## 8. Preparation review

Independent security safety-plan review: PASS; this is not execution/release approval. Independent QA plan-coverage review: PASS with an actor/fixture clarification, incorporated above (RepA/RepB are actors; U is the unassigned contact). Neither reviewer ran hosted tests or made changes. Historical460-test results were verified against unchanged source, not rerun. Current release execution remains blocked until the ordered gates pass.

## 9. Final local correction verification (2026-10-25)

The earlier preparation-only wording describes the prior documentation task. The subsequent owner-authorized final corrections changed local application/tests/docs only. Final checks: 498/498 tests across 26 files (30.70s), TypeScript PASS, production build PASS (2,785 modules, 1m29s), independent source QA/security PASS. The lead executed final commands; QA independently reviewed source and results. No hosted fixtures, SQL, customer records, webhook/Vercel settings, push, merge or deployment were changed. Step0's local checks are complete; later release gates and risk decisions remain open. Details: docs/CONTACT-001A-FINAL-POLICY-CORRECTIONS.md.
