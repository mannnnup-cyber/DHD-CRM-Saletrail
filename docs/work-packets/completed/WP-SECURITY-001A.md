# SECURITY-001A — urgent settings-only containment

Date: 2026-10-30 (America/Bogota). Status: Complete locally; release authorization pending.
Owner authorization: prepare an independently releasable settings containment patch, tests/reviews and local commit. No push, merge, deployment, hosted configuration/SQL/data change, credentials rotation, provider reconnect/send or customer mutation.

## Baseline and isolation

Branch `fix/security-001a-settings-containment`; worktree `work/security-001a`.
Exact fetched origin/master baseline `b3b55c82b31decba8a7bd66bdaa20b086a14d383`, matching the owner's production baseline and latest observed GitHub Production deployment record. No full SECURITY-001 cherry-pick. Full candidate ce45b52 and CONTACT-001A remain separate.

## Objective and scope

Fresh active owner/manager authorization, bounded supported configuration writes and secret-safe reads/errors for all settings actions and alternate WhatsApp configuration/admin actions. Settings callers carry current Bearer headers and do not persist credentials in browser storage. Use existing production Auth helpers/configuration and tables: no new hosted environment variable, migration or companion/provider enrollment prerequisite.

The WhatsApp file also contains direct configuration setters/diagnostics; excluding the entire file would leave an anonymous provider-origin/key bypass. Only that configuration slice and narrowly necessary credential-forwarding safeguards may change. Existing public connection status remains a non-secret fixed projection because denying it would disable baseline rep messaging. No new rep configuration permission is granted.

## Explicit exclusions / preservation proof

- No callback authentication, GSM/companion authentication, device binding, recording upload/Storage, customer message/label/call feature changes.
- No machine registry, new shared secret, APK dependency, database or hosting configuration change.
- Preserve callback and machine sections relative to production and test their unchanged dispatch/auth contract with synthetic fixtures only; do not infer preservation from whole-file hash because configuration shares api/whatsapp.ts.
- Fix any provider-key prefix-host/redirect exfiltration directly needed for credential containment without introducing a new media authentication/UI architecture. Remaining unrelated legacy exposures must be disclosed.
- Remove raw provider envelopes from the public message-search response using an explicit display-field projection: those envelopes can contain provider API keys. This is credential redaction only; search authorization, filters, pagination, visible fields and stored rows must not change. The ingress callback remains identical.
- If an actual dependency requires excluded workflow changes, stop and report it rather than weaken authorization.

## Ownership and impact

Single application/test implementation owner: comms_finish_impl. Lead owns work packet, context and delivery/release documentation, final full checks and local commit. Independent QA/security reviewers are read-only. No overlapping edits or reverting others' changes.

Critical impact: Settings API/UI, alternate WhatsApp configuration/admin actions and their browser callers; global provider credentials. GitNexus MCP absent; CLI impact authenticateEmail target not found in current index, generic handler resolves unrelated symbols. Static caller tracing is required and that limitation is explicit. Critical blast radius communicated before editing. Shared existing email authentication code is not modified.

## Verification and release gates

Focused actual-handler security, role/method/action/projection/error/bounds tests; actual Settings UI save/mask/caller regressions; native emitted handler startup; full suite, TypeScript, production build, independent QA/security of final diff. Prove excluded files/sections and no new env/SQL requirements. Synthetic tests only, no real provider callbacks/sends or recording/customer operations.

Deliver branch/commit/files/results, residual risk, production compatibility and ordered owner-authorized deployment/acceptance/rollback plan. Local READY does not authorize publication or production release; rollback may not restore the known anonymous settings vulnerability as the default.

## Completion

363/363 tests across 24 files, TypeScript and production build PASS. Independent final QA and security scoped PASS. No hosted changes, push or deployment. Delivery, acceptance, residual risks and rollback are recorded in docs/SECURITY-001A-CONTAINMENT-DELIVERY.md.
