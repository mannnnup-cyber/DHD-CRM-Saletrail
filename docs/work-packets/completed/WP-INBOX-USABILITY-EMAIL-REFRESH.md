# WP-INBOX-USABILITY-EMAIL-REFRESH

## Metadata
- Status: Done — implementation and independent reviews complete; release/live checks pending lead.
- Priority: P1
- Owner: inbox_usability_impl
- Dependencies: Existing authenticated mailbox sync and owner/manager auth contracts.

## Objective
Collapsible desktop navigation, honest mailbox refresh/import controls, compact personal unread help, and persisted CRM contact corrections.

## Scope
Desktop collapse preserves mobile drawer and role filtering. Unified Inbox exposes explicit AI-free latest50 sync and refresh returns to newest page. WhatsApp links to existing dedicated inbox. Existing unread receipt and label behavior remain unchanged. Contact identity corrections require active owner/manager and modern secret.

## Constraints
No hosted writes, migrations, provider settings, AI processing, publishing, sending, deployment or credential changes. Existing legacy contact endpoints remain outside broad authentication redesign; new identity action cannot pass through legacy update allowlist. CRM edits do not update external accounts or historical message contents.

## Repository Baseline
- Authoritative Git Root: C:/Users/Administrator/DHD-CRM-Saletrail
- Worktree: C:/Users/Administrator/Documents/Codex/2026-10-12/do-you-have-access-to-my/work/inbox-usability
- Branch: fix/inbox-usability-email-refresh
- Baseline origin/master and HEAD: 149b51aa9b830efaf1c10b2e53c8761a26faf365
- Preflight: PASS; isolated clean worktree before edits.

## Impact
GitNexus impact CLI attempted before edits; Sidebar/WhatsApp eventually returned LOW with zero indexed upstream callers. UnifiedInbox/ContactProfile/WhatsAppLabelControls were not found and generic handler resolved to unrelated WooCommerce, so the incomplete index cannot establish their blast radius. Manual callers: App shell/sidebar (medium, all routes layout); UnifiedInbox route (medium, existing email access contract); ContactProfile/new isolated server action (high security sensitive, mandatory independent review); WhatsApp rendering (low, receipt/label hooks untouched). No shared auth or database policy changes.

## Findings
Mailbox collection is manual. Refresh only reloaded saved records and retained an older cursor. Hosted read-only check by lead confirms current imports exist; this is not evidence of mailbox provider outage. Contact details edit currently excludes email/name/phone and silently ignores failure. Sidebar public provider-unread badge differs from personal CRM unread; remove rather than invent global personal count.

## Acceptance Criteria
1. Persisted accessible desktop collapse; mobile retains full text/drawer.
2. Refresh resets pagination; owner/manager explicit sync forces skipAi true; rep has no sync control.
3. Contact correction validates input, authenticates fresh canonical profile, denies reps/inactive and uses modern secret only; duplicate identifiers rejected; success only after database save.
4. No external synchronization promise or real customer mutations.

## Testing Requirements
Targeted UI/server regressions; type-check and build. Independent QA/security required.

## Rollback
Revert this work packet's source commit; no hosted data/schema changes.

## Implementation Report
- Implemented persisted desktop icon rail, mobile drawer preserved, accessible names/tooltips, removed confusing provider unread badge and its minute polling.
- Unified Inbox refresh returns to newest page; explicit authenticated latest50 mailbox sync forces skipAi:true. No sync on mount; stale actor/role sync responses abort and cannot update the new view. Existing Social Inbox preserved, functional WhatsApp inbox link added.
- Contact profile corrects name/email/phone/company plus existing preference fields via isolated editIdentity action. Fresh Auth + active owner/manager, modern secret only, field allowlist, email/phone validation, same-record current identity read, changed identifier duplicate preflight and visible save failures. Saved response updates profile; refresh persistence and stale route response handling covered by synthetic DOM tests.
- WhatsApp personal unread explanation moved into expandable help. Label status says verified coverage and tells user to check existing phone labels; unknown stays unknown.
- Focused tests: 40 passed initially (23 server contact, 5 inbox DOM, 2 sidebar DOM, 10 WhatsApp DOM); additional ContactProfile DOM 3 passed. Final changed-identifier server tests 24 and existing Inbox DOM 8 passed. Type-check passed. Production build passed (2782 modules, 1.30 MB single HTML output).
- Git diff --check passed. GitNexus detect_changes unavailable; git diff/status scope checked, no generated runtime/customer artifacts staged.
- No hosted mutations, IMAP sync, messages, AI processing, provider settings, migrations, credentials or deployment performed by implementation.
- Limitations: mailbox collection remains explicit/manual; no background scheduler, push notifications or Gmail OAuth introduced. Latest50 is a bounded recent import, not full backfill. Duplicate preflight has a concurrency race without hosted unique constraints and intentionally permits unchanged pre-existing duplicate identifiers. CRM corrections do not change external accounts or historical messages. Broad legacy contact API security remains outside this packet. Hosted edits and responsive visual acceptance remain release checks.
- Recommended future packet: monitored authenticated automatic mailbox collection with durable progress/backfill and failure visibility; unified triage/search/read model across channels after access contracts are verified.
- Independent QA/security and final release managed by lead.

## QA Review
Independent QA final source PASS: 52 affected tests passed. Initial full suite 294/295 had one obsolete inbox-copy assertion; corrected assertion and affected suite passed. No claim that a final full-suite rerun completed.

## Security Review
Independent security final PASS after phone digits validation, escaped case-insensitive email collision matching, actor/contact stale response guards and changed-only collision checks. Broad legacy routes and best-effort collision race remain disclosed.
