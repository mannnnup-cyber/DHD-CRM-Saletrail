# WP-SOCIAL-INBOX — BrightBean social messages and controlled replies

Status: Done (implementation deployed; operational acceptance follow-ups below). Owner authorized plan and implementation 2026-10-15.
Baseline origin/master 91399c14a8c5a821e9f582e54b09935ffd56c1a4.
Branch feat/brightbean-inbox; isolated worktree work/social-inbox.
Implementation owner social_implementation; independent QA/security required.

## Objective and evidence

Bring actual BrightBean incoming social messages and reply management into the
existing Unified Inbox. Read-only capability probe verified /me/ permissions
use_inbox and reply_from_inbox, /accounts/ 200 with three accounts and /inbox 200
with messages. No customer message bodies were logged or copied to fixtures.
Official source: brightbeanxyz/brightbean-studio README and apps/api/routers/inbox.py.

## Plan

1. Fresh JWT and active canonical owner/manager authorization for all social
   proxy actions, request-scoped modern secret only, provider key env-first with
   DB fallback. Update existing SocialMedia authenticated callers.
2. Add bounded provider inbox list/detail, cursor pagination, thread/reply status
   projection and truthful connection/permission/error/empty states. Render only
   escaped plain text; never inject HTML, remote images or raw provider payload.
3. Add Social tab to Unified Inbox, explicit draft/save/send flow and visible
   failure/uncertain status. Check provider permission/account scope before
   mutations. Use provider idempotency for duplicate-safe creation/send retries;
   never silently send on load/selection/refresh or blindly retry uncertain send.
4. Synthetic handler/UI/native ESM regression tests, full suite/type-check/build,
   independent QA/security, reviewed PR and deployment. Live real owner-session
   read verification if available; hosted unauthorized/rep denial verification.
   Never send or draft a real customer reply as an automated test.

## Security and scope boundaries

Owner/manager only: no verified BrightBean-to-CRM rep assignment exists. Do not
guess identity/contact matches. Provider account allowlist and workspace scope
must be enforced. Fixed configured upstream origin/path; bounded IDs/cursors/
body/limits/timeouts; no secrets/customer contents in logs or committed evidence.
No new browser Supabase, legacy privileged credential fallback, migrations,
RLS changes, credential rotation, auto-generated AI replies or WhatsApp changes.
Email mailbox still requires owner app-password update; do not imply this fixes it.
No automatic polling faster than provider refresh (five minutes); use manual
refresh and honor rate limits. Process-local limits are not distributed quotas.

## Acceptance

Actual handler denies anonymous/inactive/rep callers before provider calls;
permissions, unavailable provider, failed/ambiguous replies are visible and fail
closed. Safe list/detail matches real provider schema without customer fixtures.
Sent status is shown only after provider confirmation; same request retries do
not duplicate send. Actual UI proves social tab, pagination/thread selection,
draft/send controls and escaped content. Email route/tests remain working.
Native emitted modules load successfully. Hosted reads are verified separately
from synthetic tests; release report states any unavailable live-send validation.

## Review and rollback

Run GitNexus upstream impact before changing existing symbols; report high risk.
If detect_changes unavailable use exact git diff/status/diff-check scope review.
QA and security review final commit before merge. Roll back feature commit if
live reader fails; do not bypass authentication to repair it.

## Implementation evidence (2026-10-15)

Implemented on this isolated branch; release and independent final review are
owned by the lead. All social actions now authenticate. Provider list/detail,
account filter/cursor pages, explicit save/edit/discard/send and uncertain retry
reconciliation use the actual documented schemas. Creation retries use the same
provider-persisted claim; send uses the existing reply ID and provider row-state
protection, with no exactly-once external delivery guarantee. Provider sent
records without a platform receipt remain visibly unconfirmed.

Verification: full suite 186/186 across 12 files passed; three additional API edge
checks passed (21/21 social API; total 189 tests). Type-check and production build
passed. Native emitted ESM social handler reached its actual 401 guard. Synthetic
UI covers auth, escaped content, historical dates, pagination/account reset,
eligibility denial, explicit send, uncertain refresh/ack and pending-create
recovery. Lead's actual-component browser harness is synthetic, not hosted owner
proof. No real customer reply/draft, schema/RLS or provider connection mutation.
Read-only provider checks found historical Facebook DMs, no eligible first-page
reply windows, and YouTube connection error; fresh ingestion remains unverified.

GitNexus refreshed baseline origin/master before edits. UnifiedInbox, SocialMedia,
AccountCard and helper impacts were LOW; loadAnalytics has one direct caller.
Exact social handler context showed two local helper calls and one process,
but impact cannot resolve duplicate handler UID reliably; plain handler/load
match unrelated files. This CLI ambiguity was reported before edits. New social
symbols were not in the baseline index. detect_changes is unavailable; explicit
git diff/status/diff-check verification scopes the commit instead.

## Lead release closeout

Final implementation b3baab39337b71ea0b100a663b91838dba531f19 passed exact-SHA
independent QA/security. Parent reran final full suite: 189/189 across 12 files.
Type-check/build passed. PR #10 merged 4595f07c03ca91e72fb5e246bdb3903f255dda92;
CI/preview and production deployment succeeded. Hosted actual API returned 401
JSON/no-store for anonymous requests; fresh normal-rep JWT was denied across
status/accounts/analytics/inbox/message/createDraft/sendReply, inactive denied.
Only a separate synthetic normal account was created; exact Auth/profile/legacy
cleanup absence was verified. No privileged test identity or provider mutation.
Actual-component browser synthetic checks passed draft/no-send, explicit mocked
send, pagination, escaped markup/no images, uncertain send refresh/ack guards.
Live browser had no signed-in session; owner view is not claimed verified.
Real provider history/permissions/schema reads passed, but newest sampled DMs
were from 2024 and no reply was eligible. Fresh inbound delivery and a controlled
real reply require a new test message and owner participation. YouTube reconnect
remains owner work. Gmail app-password blocker and WhatsApp hold unchanged.
