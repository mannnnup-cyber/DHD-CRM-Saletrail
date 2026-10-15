# WP-INBOX-RUNTIME — emitted ESM import repair

Status: Review. Branch fix/inbox-runtime from production bec4efd.

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
