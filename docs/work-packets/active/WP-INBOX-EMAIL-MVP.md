# WP-INBOX-EMAIL-MVP — 2026-10-14

Status: In Progress. Branch feat/email-inbox-mvp from origin/master2903442.
Owner authorized plan and implementation of email-only read-only Unified Inbox.

## Concrete plan

1. Add pure runtime-validated messaging projection and deterministic dedup.
   Synthetic provider/mailbox identity is accepted only with explicit evidence.
   Live projection uses immutable email row UUID within the single persisted CRM
   email store; message_id is provenance, not proof of mailbox/account scope.
   No invented direction, email-to-contact guessing, or new ingestion.
2. Add authenticated action=inbox to existing api/email.ts. Require fresh anon
   JWT verification and active canonical profile using modern secret. Owner and
   manager read all; reps require same-ID active legacy users row and exact
   normalized legacy/profile/verified-auth email equality. Query emails joined
   contacts assigned_to that verified UUID before pagination. Unresolved or
   unassigned records never reach reps. Fixed projection excludes HTML/metadata.
   Bound query inputs and page sizes, stable UUID keyset cursor, no-store/nosniff
   and bounded best-effort per-caller limiter (serverless process-local only).
3. Authenticate every legacy email action; owner/manager only. Explicit HTTP
   mutation methods, add auth headers to old page, remove cross-user local email
   cache fallback and browser realtime bypass. Preserve management for owners.
4. Build /inbox and sidebar entry with email conversation/message selection,
   plaintext detail, verified contact links, pagination, loading/error/empty and
   refresh states. Other channels explicitly unavailable. No send/sync/AI/read
   mutation initiated by this page. Old management nav owner/manager only.
5. Actual handler/query-chain tests, synthetic projection/dedup tests and actual
   DOM UI tests. Full tests/type-check/build; independent QA and Security before
   release. Parent integrates matching context docs and release evidence.

## Schema and authorization evidence

Parent live read-only metadata verified emails.id UUID PK, UNIQUE(message_id),
body/date/read/source/contact_id; no mailbox/account/direction columns.
emails.contact_id FK contacts.id; contacts.assigned_to FK legacy users.id.
users and canonical user_profiles identities cannot be assumed equal. Require
exact same-ID and active matching verified email or deny reps. All four tables
RLS enabled with no permissive policies; privileged queries enforce row access.
No schema/RLS changes or legacy key rotation authorized.

## Scope and gates

Files: src/lib/inbox, api/email.ts plus focused helper under src/lib/inbox,
EmailInbox.tsx auth/cache, UnifiedInbox.tsx, App.tsx route, Sidebar.tsx nav,
meaningful tests. GitNexus impact before edits, functional security risk HIGH.
No new serverless function, dependencies, database tables, provider sync,
outgoing messages, WhatsApp work, real-customer copies/logging, or AI actions.
Legacy management restricts reps; new Inbox is their safe read surface.
Live release must acknowledge unresolved deferred credential exposure; local
rate limiter is defense in depth and does not claim distributed protection.

## Implementation report and release snapshot

- Implemented the pure explicit-fixture normalizer and collision-safe
  provider/mailbox/external-ID identity; live projection uses the immutable
  single-store email UUID and never invents direction or contact links.
- New action=inbox uses active verified identity, modern-secret request clients,
  exact same-ID legacy identity/email proof for reps, and assigned-contact
  filtering before stable date/UUID keyset pagination. Raw PostgreSQL timestamp
  precision is preserved in the cursor, including explicit null-date paging.
- All legacy email actions require owner/manager auth. Existing management
  callers send bearer headers and use explicit mutation methods. Reps see a
  truthful access denial on the direct management page. Unscoped cached-email
  fallback and browser realtime bypass removed.
- Read-only /inbox displays escaped plaintext, selected message, verified contact
  links, pagination, loading/error/empty states, HTML-only content explanation,
  long-body truncation warning, and unavailable other channels.
- Independent QA passed the full baseline 156 tests, type-check and build.
  Final focused projection suite passed 18 tests after adding four evidence
  bounds cases; final type-check passed. PATCH is included in CORS allowed
  methods for the newly explicit management PATCH calls.
- Parent actual-browser synthetic verification passed styled UI selection,
  pagination and escaped malicious markup with zero article images. This is
  component evidence with mocked context/API, not live authenticated data proof.
- Independent Security initial review found no auth blocker; final snapshot
  review and deployment/live synthetic row-scope validation remain pending.
- Tests prove the actual handler and query chain, not PostgreSQL execution.
  No provider sync, outbound send, AI, migration, RLS or credential mutation was
  initiated during implementation validation.
- Rate limiting is bounded process-local defense in depth, not distributed
  enforcement. No global app CSP was changed; plaintext removes message HTML
  and remote-image rendering in this route. Deferred legacy credential exposure
  remains open and is not closed by this work packet.
- GitNexus pre-edit impacts and exact handler context reviewed; new normalizer
  impact request returned target-not-found in the pre-edit index. No exposed
  detect_changes command/tool exists here; reviewed git diff/status and
  diff-check verify commit scope. Only generated GitNexus skill EOL artifacts
  were restored; all parent context documentation is preserved.
