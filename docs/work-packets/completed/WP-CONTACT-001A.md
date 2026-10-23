# WP-CONTACT-001A — Secure contact review

## Metadata
- Status: Done - local implementation and independent reviews complete; hosted view repair/release pending separate authorization.
- Priority: P1
- Owner / assigned agent: inbox_usability_impl
- Dependencies: CONTACT-001 plan a2356af; independent QA/security required.

## Objective / Business Background
Expose authorized duplicate candidates and bounded comparison while preserving correction drafts and containing unsafe legacy merge/enrichment bypasses.

## Current State
Legacy contacts and organization reads bypass modern contact-edit authorization. Existing merge does not transfer/retire records. Review follows docs/CONTACT-001-DUPLICATE-MANAGEMENT-PLAN.md; only packet A is authorized.

## Scope / Functional Requirements
Fresh Auth and active canonical profile; owners/managers business scope, reps exact verified legacy UUID/email agreement and assigned contacts only. Server-scoped list/search/count/paging/candidates/compare; structured correction409. UI View/Compare without losing draft. Compare contains identity/provenance/counts/bounded activity metadata only, never email/WhatsApp contents. Unsafe merge and enrichment overwrite disabled. Related contact/organization alternate reads/writes contained without altering trusted integration helpers/webhooks.

## Out of Scope
No merge execution, contact deletion/relationship transfers, new decision/approval tables, provider calls/configuration, hosted data/schema/grant changes, credentials, deployment, push or master merge. SQL view repair is PREPARATION ONLY.

## UX Requirements
Responsive accessible comparison, deterministic evidence not probabilities, visible scope counts, generic restricted guidance without hidden PII/counts. Rep identity editing remains denied. Existing inbox/contact identities remain stable.

## Technical / Security Constraints
All browser requests authenticated; new server client uses modern secret only. No privileged browser Supabase. Validate methods/IDs/JSON/limits; no-store; authorize before projection/counts. Independent channel scopes for summaries. No inference that PN/LID or similar external IDs are equal. Preserve authorized integration-side helpers.

## Expected Files
api/contacts.ts; contacts auth/read/review/edit helpers; contact list/profile/comparison; related CRM alternate dispatch/UI callers; narrow unapplied view migration; tests/context docs.

## Repository Baseline
- Authoritative Git Root: C:/Users/Administrator/DHD-CRM-Saletrail
- Baseline origin/master: b3b55c82b31decba8a7bd66bdaa20b086a14d383
- HEAD: a2356af (planning commit)
- Worktree: C:/Users/Administrator/Documents/Codex/2026-10-12/do-you-have-access-to-my/work/contact-001a
- Branch: feat/contact-001a-secure-review
- Ahead/behind: planning-only ahead, production baseline unchanged after lead fetch.
- Nested repo: none. Preflight PASS.

## Impact / HIGH Risk Warning
GitNexus impact attempted before edits for handlers, Contacts, ContactProfileContent, editContact. Generic handler resolved to unrelated WooCommerce (LOW indexed upstream); ContactProfileContent, Contacts and editContact were not found. Index incomplete; manual impact therefore governs. Manual HIGH blast radius: contact/API authorization, ContactProfile/Contacts/caller headers, related CRM contact/organization projections; risk of hidden-contact/history exposure or caller denial. Lead warned before changes. Scope approved explicitly; mandatory QA/security. Trusted provider ingestion helpers remain untouched.

## Testing / Acceptance
Actual handler tests for auth/roles/assignment mismatch, denied guessed IDs, hidden candidates/counts, safe comparison projections, disabled merge/enrichment, bounded counts/paging and API methods. DOM conflict draft retention and responsive accessible comparison. Native ESM import regression; relevant integration regression tests; type-check/build. No real customer/provider mutation tests.

## Rollback
Revert application changes. Prepared SQL is not applied; no hosted rollback needed. Hosted view repair remains separate owner-approved safeguard gate.

## Definition of Done / Implementation Report
Implemented local packet A only. See docs/CONTACT-001A-DELIVERY.md for complete scope, evidence and limitations.
- Secure caller/visibility contract, bounded SQL counts/paging/candidates, structured409 and stable match-scope paging.
- Read-only authorized staff review, owner/manager correction, retained drafts, responsive comparison and keyboard focus containment.
- Disabled unsafe legacy merge/enrichment; contained related CRM/organization/store UI alternatives; trusted integration helpers/webhooks/automation remain unchanged.
- Prepared only migration20261023205637 SHA2567d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7. Root verified nine local synthetic PG17.10 role/view count assertions; server stopped. No hosted application.
- Implementation initial71 focused tests PASS; final affected65 PASS after provenance/matchscope delta. Independent QA344 full before final delta +45 affected final PASS; final type-check/build PASS(2784 modules,14.08s), diff check PASS.
- No hosted customer/schema/grant mutation, provider request, message send, merge/delete/transfer, deployment, push or credentials change.
- No actual mobile screenshot verification. Comparison is not a merge manifest; duplicate checks are best effort. Hosted view exposure and unrelated legacy channel/automation security remain unresolved outside this local implementation.
- Lead owns final scoped local commit. No release authorization inferred.

## QA Review
Independent QA final PASS: full344 before narrow final delta;45 final affected; final type-check and production build passed. No final full-suite rerun claim.

## Security Review
Independent source security PASS, including source provenance allowlist, stable candidate matchScope and role/channel boundaries. Prepared view SQL remains unapplied; local synthetic role tests do not prove hosted remediation.
