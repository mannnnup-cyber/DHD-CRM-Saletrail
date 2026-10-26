# WP-CONTACT-001A-POLICY-CORRECTIONS

## Metadata
Status: Done - local implementation and independent review complete; release and hosted validation remain gated. Owner: inbox_usability_impl. Date: 2026-10-25. Parent: CONTACT-001A.

## Objective / Scope
Implement the adopted explicit shared-identifier keep-separate workflow for owner/manager creation and correction, with audit and stale protection. Restrict reps consistently to assigned basic contacts plus their own properly attributed notes. Preserve customer IDs/relationships; never auto-select, merge, overwrite another contact or transfer children.

## Baseline / Preflight
Worktree: work/contact-001a. Branch: feat/contact-001a-secure-review. Baseline dd4f7955f5f1f39b3227ca2a6a444fa41696b5ca; initially clean. Required context and Supabase/GitNexus guidance read. No hosted access/mutation authorized to implementation. Root supplied catalog evidence that interactions supports UUID PK, nullable contact_id, JSONB metadata and NOTE/OUTBOUND constraints.

## Impact / HIGH Warning
GitNexus CLI impact attempted before edits. Initial requests required repository selection; repo-qualified editContact/compareContacts/guardOrganizations all returned target not found. Index incomplete; manual HIGH/critical auth/write blast radius warned to lead before edits: contacts read/candidate/compare/detail, organization alternatives, owner correction/create, Profile and Contacts UI. Fresh auth, canonical rep agreement and provider ingestion helpers remain preserved. No index rebuild or tooling install.

## Implementation
Signed expiring grants bind actor, purpose, target, normalized proposal, original seven editable fields and all reviewed <=20 candidate snapshots. Re-read candidates and fresh role before contact mutation. PK nonce intent insert is a durable cross-worker single-use claim; failed intent prevents contact mutation. Contact CAS then outcome update; failed/zero/transport outcome reports uncertainty rather than success. Audit NOTE source is contact-shared-review with permanently NULL contact_id and protected metadata IDs/digests; rep own-note queries exclude it. No-op shared corrections rejected. New contact form and correction panel require acknowledgement/reason and preserve drafts on cancel. Unknown shared outcomes block the current mounted UI; this is not a global retry lock.

Rep responses use an explicit basic allowlist; no finance/channel/organization histories or counts queried. Own notes require contact_id, NOTE, canonical actor_id, source contact-note and version1. No rep identity edit right is added.

## Tests / Independent Review
Actual handler tests cover shared create/edit, replay/concurrency PK, actor/purpose/target/proposal/expected/candidate changes, expiry, overflow, role drift, failed intent and uncertain finalization; strict rep projections/aliases/org restrictions. DOM covers acknowledgement/reason/cancel, draft retention, lost transport/JSON outcomes, unmount abort and rep finance/control hiding. Native emitted ESM includes the new helper. Final focused seven-file run213/213 PASS; final additional handler run168/168 PASS. Root-run complete suite498/498 across26 files PASS (30.70s), final type-check exit0 PASS, production build exit0 PASS (2,785 modules,1m29s; bundle1,318,009 bytes / gzip350.70kB). Independent QA source/results PASS; scoped security final PASS. Private bundle inspection reported zero hits for two privileged values and privileged prefixes; no privileged values are recorded here. These local checks do not establish hosted Auth/RLS behavior or live UI correctness.

## Restrictions / Residuals / Rollback
No hosted data/schema/permission/config change, push/deploy/merge or provider operation. No new RPC/migration or global identifier uniqueness. Audit and contact save are not atomic; role/candidate rechecks leave cross-statement TOCTOU. Ordinary no-match creation retries remain non-idempotent; shared-token reuse is protected by existing PK. Audit intent with unknown outcome requires manual reconciliation, never blind retry/new review. UI uncertainty blocking resets if unmounted/reopened and is not cross-session enforcement. Roll back this local packet by reviewed revert only; no hosted rollback is needed.

## Final Handoff
Local source is frozen for root review and commit. No application/test changes followed final full-suite verification. Root owns final policy report and controlled release plan. No push, deployment, provider action, hosted mutation or migration occurred. GitNexus change detector is unavailable in this session; final git diff/status scope verification is used instead. Residual gates remain explicit; completion means local implementation/review, not authorization or completion of a release.
