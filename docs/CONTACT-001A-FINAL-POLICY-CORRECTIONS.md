# CONTACT-001A — final policy corrections

Date: 2026-10-25 (America/Bogota). Existing feature branch: `feat/contact-001a-secure-review`. Starting commit: `dd4f7955f5f1f39b3227ca2a6a444fa41696b5ca`, clean worktree.

Status: LOCAL CORRECTIONS COMPLETE — full verification and independent scoped QA/security PASS. This report does not authorize publication, configuration changes, hosted SQL or production release.

## Scope and evidence boundaries

Owner-authorized local corrections cover deliberate owner/manager shared-identifier saves with audit evidence, and assigned-rep basic-contact/own-note visibility. Shared identifiers do not establish identity; no automatic reuse, merge, child transfer or overwrite of the matching record is permitted.

No customer rows were read for this task. Read-only hosted catalog inspection in project `vatsonbvjkyzxqrnderr` verified the existing audit-storage prerequisites: `interactions.id` is a UUID primary key; `contact_id` and `user_id` are nullable; metadata is JSONB. NOTE is permitted by the type CHECK, OUTBOUND by the direction CHECK. No noninternal triggers exist on interactions. The contact FK has ON DELETE CASCADE, and the user FK ON DELETE SET NULL. Audit design must therefore keep contact_id NULL and identify the operation's contacts in server-generated metadata, rather than inherit contact deletion cascades. This is schema compatibility evidence, not a hosted functional test.

The existing three-view migration, deployment configuration and integration settings are outside this correction. Their prior evidence and approval gates remain in the controlled release plan.

## Exact application changes

- `src/lib/contacts/shared-review-server.ts`: HMAC-signed, domain-separated three-minute grants bind the canonical actor, edit/create purpose, target UUID, normalized proposal, original edit snapshot and complete candidate fingerprint. A complete set of 1–20 matches is required. Confirmation requires keep-separate acknowledgment and a bounded nonempty reason. Recomputed candidates and fresh active owner/manager identity are checked before mutation. A UUID primary-key insert into existing interactions claims the grant once across workers; replay/parallel reuse cannot save twice through the same grant. No new schema, settings or secret is required.
- `edit-server.ts`: conflict responses issue the review grant; confirmed corrections retain seven-original-field CAS. Stale, changed proposal/candidates, absent acknowledgment, no-op confirmation or changed role fails closed. Only the target contact updates; matching records/children do not change.
- `api-server.ts`: resolve no longer treats matching identifiers as a permanent prohibition. After deliberate review it creates a new UUID bound to the grant, checks the returned UUID and never returns a preexisting contact as a successful resolution. Failed/unknown mutation or audit finalization is explicit uncertainty. Legacy merge/enrichment remains disabled.
- `auth-server.ts`, `review-server.ts`, `api-server.ts`: reps receive an explicit basic identity/status/contact-type projection. Candidate discovery remains assignment scoped; comparison queries only the rep's NOTE records with actor_id/source/version predicates. No financial, channel, relationship or other-staff history query is made for reps. Detail retains a final assignment check. Counts only describe permitted contacts; restricted histories are not represented as verified zeros.
- `organization-server.ts`: rep organization reads return restricted/unavailable without membership query/count; owner/manager paths remain authorized business reads.
- `ContactProfile.tsx`, `Contacts.tsx`, `ContactCompare.tsx`, `review.ts`: shared correction acknowledgment/reason with View/Compare; restricted rep sections hidden; own-note wording; draft and confirmation lifecycle guards. New `ContactCreate.tsx` provides owner/manager manual creation, candidate identities/company and View links, explicit separate-record confirmation, keyboard/focus behavior, cancellation and preserved drafts. Changed drafts invalidate review. Pending saves lock controls. Unknown confirmed-response outcomes disable retry and direct reconciliation.
- Actual-handler, edit, profile, comparison and new creation DOM tests cover negative authorization, stale edits, candidate/role drift, altered/expired grants, purpose/target mismatch, durable replay/parallel claims, audit failures, missing reasons, shared phone/email and lost/invalid responses. Context documentation and the work packet record the revised contract.

## Audit semantics and concurrency limits

Audit metadata is server generated: actor/role, operation UUID, purpose, target, candidate IDs, review-state fingerprint, proposed field names, reason, timestamps and outcome. It does not store provider credentials or unrestricted channel bodies. The intent uses NOTE/source=contact-shared-review, distinct from rep-visible source=contact-note. contact_id remains NULL, so this audit is not automatically deleted with a contact. Failure to persist intent prevents mutation. Confirmed, rejected-stale, rejected-candidate-drift, rejected-authorization and uncertain outcomes are distinguishable. Successful saves require verified outcome finalization; loss/failure produces SHARED_SAVE_UNCERTAIN rather than false success. A pending intent is not evidence of a completed save. There is no automatic recovery or retry.

Separate PostgREST statements cannot provide a transaction spanning grant claim, candidate/role check, contact mutation and outcome. Changes observed before the final check are rejected; changes after it are not atomically locked. Edit target CAS protects the seven original fields, not every unrelated field or every writer. Ordinary unmatched creation remains non-idempotent; different valid review grants can intentionally create different records. More than 20 matches cannot be confirmed through this bounded review. These limits require release acceptance or a separately approved transactional design; no global unique email/phone constraint or unsafe merge was introduced.

For an uncertain operation, an authorized operator must inspect the protected audit by exact operation UUID and reconcile its target/current state using server-side access before another review. A network error or pending intent alone cannot prove whether a contact write committed. UI uncertainty blocking lasts for the mounted editor/dialog; closing/reopening is not a durable cross-session lock. Server single-use claims still reject the same token, but a newly issued grant is a new decision. Keep audit evidence; never delete/merge a contact to hide a failed test or reconcile automatically.

## Final verification

Implementation focused tests: 213/213 across seven files; final expanded actual-handler run: 168/168. Final frozen-source command results, executed by the lead and independently reviewed by QA:

| Check | Actual result |
| --- | --- |
| npm test -- --testTimeout=15000 | PASS: 498/498 tests, 26/26 files, 30.70s |
| npm run type-check | PASS: tsc --noEmit, exit 0 |
| npm run build | PASS: 2,785 modules, 1m29s; index.html 1,318.01 kB / gzip 350.70 kB (1,318,009 bytes) |
| Private build scan | Two available configured privileged values checked, zero matches; sb_secret prefix zero matches. Values were not printed. This is a bounded check, not proof about unavailable secrets. |
| Independent QA | PASS: source acceptance/privacy review and independent interpretation of the lead-run checks. QA did not claim a separate full rerun. |
| Independent security | PASS: final source, including returned creation-ID validation, confirmation/audit/replay controls, rep projections/queries and server-only signing secret. No hosted security proof implied. |
| Scope/diff | git diff --check PASS; existing migration checksum unchanged: 7d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7. No provider, Vercel/GitHub, dependency or SQL file changes. |

No application/test changes followed the final verification. Completed work packet: docs/work-packets/completed/WP-CONTACT-001A-POLICY-CORRECTIONS.md. This correction's local commit is the commit introducing this report together with the application changes; inspect git log for its immutable SHA rather than treating the starting documentation commit as the tested implementation.

GitNexus tools were unavailable and the CLI index did not cover the relevant current symbols. Manual HIGH/critical-impact tracing covered list/detail/candidates/comparison, correction/create, notes, organizations, UI and callers. Final git scope/diff checks substitute for unavailable detect_changes; no complete graph proof is claimed.

## Release blockers

Hosted Auth/PostgREST and desktop/mobile acceptance with approved isolated synthetic fixtures remain unexecuted. The three-view migration remains unapplied; an actual recoverable CRM backup/restore and consumer reconciliation are still prerequisites. GitHub publication remains blocked by the active fixed-master Deploy Hook until its separately approved correction is verified. No push, merge, deployment, hosted data/permission change, migration or provider operation is authorized by these corrections.
