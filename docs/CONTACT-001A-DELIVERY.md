# CONTACT-001A - Secure contact review delivery

Date: 2026-10-23 (America/Bogota)
Status: LOCAL IMPLEMENTATION COMPLETE - independent QA/security PASS; no hosted migration, release or deployment performed.
Branch: feat/contact-001a-secure-review
Production baseline: b3b55c82b31decba8a7bd66bdaa20b086a14d383
Planning starting commit: a2356af

## Implemented scope
- Fresh Supabase Auth, active canonical roles, modern secret only. Owners/managers business scope; reps require exact active legacy UUID/email agreement and assigned contacts. No identity-by-name/email translation.
- Bounded SQL-scoped contact list/search/count/UUID paging and deterministic candidate discovery. Counts fail closed when unavailable. Exact identifier evidence, possible legacy suffix/name and conflicting evidence replace probability scores. No Gmail plus/dot collapsing or international-country guessing.
- Structured correction409: matching field, permitted candidates/scoped total, View/Compare, generic review guidance. Draft survives rejection/comparison. Identifier-only conflict paging remains identifier-only, including common-name fixtures. Staff identity editing remains denied.
- Read-only candidate review on profiles for all permitted roles. Responsive comparison includes field match/conflict/completeness, source/creation provenance, exact independently permitted relationship counts and at most ten activity metadata rows. No email/WhatsApp bodies, subjects, raw_data or provider identity contents.
- Separate channel scope: assigned-rep email counts follow existing verified contact/email ownership; other channels/accounting/call/activity/store/organization summaries are null/restricted where a separate verified contract is absent. Both comparison UUIDs and both organization endpoints are authorized independently.
- Legacy merge/enrichment overwrite/migration execution disabled with truthful messages. No delete, consolidation, relationship transfer, canonical redirect, proposal/approval or durable distinct decision introduced.
- Contact-facing CRM organization alternatives and business-wide dashboard/opportunities/team plus WooCommerce UI API contained; legitimate callers attach auth. Store-wide rep UI is explicitly unavailable before loading cached data. Trusted integration resolvers, provider webhooks and automation/cron remain unchanged.
- Existing owner note/organization/order-link operations remain authorized; an order compare-and-set cannot report success after a zero-row race, cannot transfer another contact's order and is idempotent for the existing same link. Creation preserves only validated source provenance, including GSM.

## Prepared SQL - NOT APPLIED
File: supabase/migrations/20261023205637_contact_review_view_security.sql
Created with Supabase CLI2.122.0 migration new after checking migration new --help. No db push/reset/apply command ran.
SHA256: 7d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7
Transaction: BEGIN; ALTER VIEW SET(security_invoker=true) for enrichment_status, org_members_all and org_members_current only; COMMIT. A missing view fails rather than silently skipping.
No definitions, base rows, RLS policies, grants, roles, credentials, decision tables or merge RPCs change.

### Reproducible local synthetic verification
A fresh disposable PostgreSQL17.10 cluster outside Git created synthetic base data, RLS, three owner-context views and anon/authenticated/service_role roles. Before the migration, anon saw one synthetic row through the owner view. Applying the exact prepared transaction set security_invoker=true on all three views. Nine role/view count assertions then passed: anon0, authenticated0 and service_role1 for each view. The base synthetic row remained one. The test cluster is C:/Users/Administrator/.codex/private/follops-db-validation/contact-001a-synthetic; server stopped. The initial assertion harness required a CASE-expression parentheses correction; the migration itself succeeded on its first attempt.
This is local synthetic PostgreSQL evidence, not hosted Data API/Auth/RLS verification. No real customer data was used in that cluster.

## Test and review evidence
- Focused initial71 tests passed across real mocked handlers, correction validation, deterministic evidence, contact/profile/comparison DOM and native emitted ESM loading.
- Final affected65 tests passed after source-provenance and stable conflict-pagination regressions (34 handler,24 correction,7 profile DOM).
- Independent QA PASS: full344-test suite passed before the final narrow source/provenance/pagination delta, followed by45 affected tests on the final delta. This is not a claim of a final full-suite rerun.
- Final type-check PASS; final production build PASS (2784 modules,14.08 seconds); git diff --check PASS.
- Independent security final source PASS, including validated source allowlist and stable matchScope delta. Hosted view application/security validation remains pending.
- Responsive DOM/classes and modal keyboard behavior tested synthetically; no actual mobile screenshot or hosted contact-mutation validation performed.
- GitNexus impact attempted before production edits. Generic handler resolved to unrelated WooCommerce; ContactProfileContent/Contacts/editContact were absent in the incomplete index. Manual HIGH blast radius reported before edits, with explicit owner-approved contact-security scope and independent reviews. detect_changes unavailable; manual git diff/status scope checks used.

## Limitations and release gates
- No hosted data/schema/grant mutation, provider request, mailbox sync, message send, merge, deployment or push performed.
- The three hosted owner-context views remain unchanged and potentially exposed until a separately approved safeguard/migration/hosted validation packet. Do not call hosted security repaired.
- Public legacy WhatsApp/channel reads, other unrelated CRM/API paths and unchanged automation/cron weaknesses remain outside scope. This is not a claim that the entire CRM is secure.
- Duplicate discovery uses stored email/normalized legacy phone and exact name hints; missing/stale normalization can miss candidates. Candidate matches are not proof of duplicate people or provider-account ownership.
- Creation/correction collision preflights are best effort without database uniqueness constraints; no global unique shared email/phone rule was introduced. Current rows can change between read requests; comparison is not an approved merge manifest.
- Existing owner organization mutations retain their nontransactional compatibility behavior; no merge-like preservation guarantee is claimed for them.
- SQL application needs separate explicit approval, fresh target/schema/backup/recovery safeguards and hosted validation. No Contact001B/C/D schema or execution was applied.

## Next packet
Principal Architect review of CONTACT-001A and the narrowly prepared view repair. Durable distinct decisions, staff proposals and manager approval require CONTACT-001B; transaction/identity lifecycle/merge execution remain later separately approved work. No real customer merge should be attempted through this release.
