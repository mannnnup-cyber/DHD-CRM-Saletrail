# WP-INBOX-RUNTIME — emitted ESM import repair

Status: Done. Branch fix/inbox-runtime from production bec4efd.

Production /api/email?action=inbox returned HTTP500 text/plain with
FUNCTION_INVOCATION_FAILED before the JSON auth guard. /api/users returned its
normal unauthenticated401JSON. Parent reproduced ERR_MODULE_NOT_FOUND by
transpiling the actual email handler/helpers to unbundled ESNext and loading
with native Node: the extensionless email-server import could not resolve.

Fix only the two runtime import specifiers: api/email.ts imports
../src/lib/inbox/email-server.js; email-server.ts imports ./email.js. TypeScript
resolves those to source .ts files and emitted Node ESM resolves the .js files.
No function body, auth/role/row gate, projection, pagination or provider changes.
No unsafe rollback or authentication bypass.

Native-emission regression transpiles the three real modules into a temporary
ESM package, links installed dependencies, blocks network calls, and imports
with native Node. It invokes the actual handler without a bearer and requires
401JSON plus no-store. This checks runtime resolution beyond Vitest/Vite's
bundled module resolution. Temporary output is removed within verified bounds.

Existing graph/static dependency evidence applies to these import-only edits;
no named function/class/method edited and no broad re-index performed. Scope
verified by git diff/status; detect_changes tool unavailable in this environment.
Target regression/Inbox tests and type-check are local release checks. Final
QA/Security review, deployment and live invocation proof remain required.
No production records/credentials/RLS changed and no provider messages sent.

Local verification: all 161 tests across 9 files passed, including the native
Node emitted-module regression; npm run type-check passed. Parent's independent
native emitted-handler probe also returned 401 JSON with Cache-Control no-store.
Independent QA/Security and deployed invocation proof are recorded by the lead.

## Release closeout — 2026-10-15

Status: Done. Main PR #7 merged bec4efd; runtime PR #8 merged 8ce7639.
Native ESM import repair fcc3218 passed independent QA/security, 161 tests across
9 files, type-check and CI build. Production deployment 7092521728 succeeded.
Actual live unauthenticated requests return 401 JSON instead of startup 500.
Hosted synthetic normal-rep verification passed: fresh JWT, missing identity
mapping denied, five owned messages in three pages including equal microsecond
and null timestamps, foreign/unresolved messages hidden, verified contacts,
bounded plaintext/truncation, invalid input 400, legacy reads/mutations 403,
inactive profile 403. Exact fixture cleanup and absence checks passed.
The DB automatically creates a legacy users mapping on provisioning; only the
synthetic mapping was removed/recreated to exercise denial. No owner/manager
impersonation, customer records copied or outbound messages. Previously created
user setup test account and Kayci accounts were untouched. Browser component
checks used synthetic context/API, not a live owner inbox. Email-only/read-only;
WhatsApp on hold, social/replies future. Process-local quotas, global CSP and
deferred credential P0 limitations remain. This closeout supersedes earlier
pending review/release statements below.
