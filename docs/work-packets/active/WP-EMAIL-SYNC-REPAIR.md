# WP-EMAIL-SYNC-REPAIR
Status: Review
Baseline: 098c63f
Scope: saved server-only IMAP credentials; explicit bounded manual import with AI opt-out; truthful persistence counters and safe failures; real authenticated saved-mailbox validation.
Security constraints: owner/manager only, modern server secret, trusted TLS, no client-controlled destinations or returned message bodies, no production tests by implementation worker.
Verification: mocked handler/config/persistence tests, full tests, type-check/build; independent QA/security required before release.
Impact: GitNexus doSync LOW:2 callers/2 processes; handleTest LOW:1 caller/1 process. Generic handler selects WooCommerce incorrectly; exact-file context plus static route callers used. No shared auth changes.

Implementation verification: new actual-handler tests13/13 passed; TypeScript noEmit passed; full-suite backend/native tests passed so far with UI environment startup pending; production build pending. CI now runs type-check/tests/build on Node22 before merge. No production mailbox mutations performed by implementation worker. GitNexus detect_changes unavailable; git diff/status/diff-check scope fallback passed. React best-practices checklist applied: no new effects, explicit fetch action, bounded status, accessible live alert/status, no browser secrets in request.

Live verification follow-up: lead verified50 stored emails,13 linked contacts. All50 had keyword-fallback analysis, which does not establish whether an external AI request was attempted. Older cached clients may omit skipAi. Follow-up changes server default to no AI unless skipAi is explicitly false and saved AI setting is enabled; current UI continues sending true. No customer content is recorded here. Existing impact scope applies; upstream doSync impact rerun attempted before this bounded handler change.

Owner-browser evidence reported by lead: Unified Inbox showed25 messages on the first page and25 on the second; Next was disabled on the second page and the final message detail opened. This confirms the50 stored emails are readable in the live UI. Follow-up targeted tests15/15 passed; independent review and CI remain release gates.
