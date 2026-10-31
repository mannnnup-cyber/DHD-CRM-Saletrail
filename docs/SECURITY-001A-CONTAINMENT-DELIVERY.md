# SECURITY-001A — settings-only containment

Date: 2026-10-30 (America/Bogota). **Local verification complete — READY for review, no production release authorized.**

Branch `fix/security-001a-settings-containment`; exact base `b3b55c82b31decba8a7bd66bdaa20b086a14d383`. Origin/master was fetched and matched the owner's production baseline; GitHub deployment records also identify that production revision. This is an isolated worktree from master, not a cherry-pick of the blocked SECURITY-001 commit or its preview ancestry. CONTACT-001A and SECURITY-001 remain separate. Current Vercel alias/environment values were not independently certified by this local task.

## Scope and containment boundary

The legacy settings API alone is not the entire configuration boundary. `api/whatsapp.ts` also exposes provider URL/key setters, configuration diagnostics and instance administration. Leaving those anonymous would allow a caller to repoint the server and escape the first fix. The narrow patch therefore protects seven settings actions and 13 alternate WhatsApp configuration actions using fresh active owner/manager authorization, safe output and explicit mutation methods. It does not introduce generic WhatsApp/companion authentication.

Two credential escapes also require narrow redaction/transport corrections: arbitrary URL media proxying must never attach the global provider key, and message search must not return a raw stored webhook envelope that can include that key. These corrections do not change media UI/authentication or search permissions/filtering/pagination. No historical rows are rewritten.

Existing non-secret public connection status remains available, preserving baseline rep messaging. Restricting that status endpoint to owners would disable the current rep send UI; no new rep configuration permission is added. Callback and companion handling, recordings, message sending, history/calls/labels and application routing retain the baseline contract except the explicitly identified credential-response/transport corrections.

## Intended changed files and controls

- `api/settings.ts`: explicit methods and fresh owner/manager guard for list/get/categories/save/provider tests; safe credential projection and supported bounded values; preserve baseline blank/masked secrets; credential-free errors and fixed provider test destinations. No new clear-secret feature.
- `api/whatsapp.ts`: guard/redact only configuration/admin cases; update their intended callers; preserve public status; stop administrative-key forwarding in arbitrary URL mode, reject JSON in that media response path, and disallow redirects on the fixed credentialed media decoder. Return only intended search display fields, not raw envelopes. Callback/machine workflows are not authenticated or reconfigured here.
- `src/lib/settings/server.ts`: reuse the existing `authenticateEmail` helper plus owner/manager and project-target checks; do not mutate shared authentication. Do not write headers after that helper has already sent a denial response.
- `src/lib/settings/projection.ts`: pure known-safe read/supported-write rules, credential masking and input bounds; no machine credential registry.
- `src/lib/settings/client.ts`: same-origin current Bearer transport for private settings/configuration calls only.
- `src/pages/Settings.tsx`, `src/pages/WhatsApp.tsx`: minimal configuration caller/method updates and private credential-draft/async-result actor cleanup. No layout, media, messaging or global authentication redesign.
- Focused handler/component/native/scope regression tests; exact final inventory and results below after verification.

Private WhatsApp configuration actions: GET webhookInfo/getEvolutionConfig/webhookConfig/fullDiagnostics/diagnostics; POST setWebhook/saveEvolutionConfig/createInstance/getQRCode/getInstanceStatus/disconnect/debugSaveInstance/publishVersion. Seven settings actions: GET list/get/categories and POST save/testEmail/testResend/testOpenAI. Missing/invalid sessions deny401, inactive/nonmanager identities403, wrong methods405 and unsupported inputs400; configuration/identity lookup failure denies closed. No frontend identity claim grants access.

## Production compatibility and dependencies

**No new hosted environment variable, migration, table, column, policy, provider header, credential registry, APK change, device organization binding or Storage setup is required by this patch.** Existing production Email authentication configuration and user_profiles/app_settings are reused: trusted Supabase URL, anonymous Auth client key and modern SUPABASE_SECRET_KEY. Existing provider settings precedence is preserved. Missing/inconsistent existing auth configuration must deny private settings, never fall back to anonymous or legacy privilege.

The blocked full SECURITY-001 requirements—callback header, companion/device enrollment and recordings resources—are not activation dependencies here. No FOLLOPS_COMPANION_CREDENTIALS/FOLLOPS_WHATSAPP_WEBHOOKS requirement or callback shared-secret guard is included. No deployment configuration/package/dependency update is intended.

Public CDN media requests remain credential-free and retain their baseline redirect behavior. Arbitrary URL-mode proxy requests no longer receive an administrative API key; protected provider admin/JSON endpoints are not a supported media workflow. The existing fixed message-ID media decoder retains the provider credential it needs. This is not a complete SSRF/media privacy repair.

## Remaining exposure

This is **settings credential containment, not full communications security**. Existing public/legacy message/history/send/media/ingress/device/recording risks, active MIME/public-cache concerns, identity association and replay gaps remain for separate work. Callback authentication and stored raw ingress are unchanged; raw credentials are removed from the identified public response projection rather than rewritten at rest. Arbitrary sensitive text pasted into actual customer message content is not scrubbed by this patch.

Earlier credential exposure is not undone. The prior read-only review found stored integration credentials, including a GreenAPI token typed as text. No values were retrieved/printed or rotated here. Securely review effective consumers and rotate potentially exposed credentials only under separate owner approval after containment; do not rotate a key into an unchanged readable route. Existing saved configuration may also need an owner-controlled integrity review; no customer/provider settings are repaired automatically.

## Proposed controlled release / acceptance

1. Owner/PA reviews the exact local commit and final QA/security/test evidence. Recheck production/master against b3b55c8; if it moved, stop, reconcile and retest rather than merge blindly. Publication, preview creation, merge and production deployment each remain separately authorized; do not trigger them as tests. Verify GitHub/Vercel deployment controls before any later push.
2. Privately verify the **existing** Auth/project configuration matches the already deployed Email flow and the legacy WhatsApp database target. Do not disclose secrets or create new variables. A mismatch or inability to perform the authorized-owner positive read is a release STOP, not permission for a fallback.
3. Use approved isolated synthetic fixtures for positive saves/provider tests/pairing behavior. Existing local actual-handler/UI/native tests cover these paths without touching production settings. A hosted preview must not inherit production mutation permissions implicitly; no real account reconnect, callback change, customer send, credential test email or device update is part of this task.
4. After separately authorized deployment, verify the exact deployed revision and read-only anonymous/rep/inactive/owner/manager settings results. Anonymous/lower-role reads must deny and owner/manager reads must redact values. Inspect status/field assertions only; never print response bodies if a redaction regression is detected. Confirm the non-secret status and existing communications health metadata remain available without generating customer traffic.
5. Do not casually probe live stateful admin actions with missing authentication: if a bad deployment omitted the guard, disconnect/create/QR/setWebhook can mutate the real service even with an empty body. Run these negative tests against synthetic handlers/isolated fixtures; live acceptance uses safe read-only routes and exact code-identity proof. No valid real configuration write is needed merely to test authorization. Save validation tests must use an isolated synthetic environment or a proven no-write invalid payload.
6. Monitor403/405/503 errors and known workflows. Stop for an unmasked credential, unauthorized effect, missing owner access, wrong HTTP method, current-token/actor regression or changed callback/companion behavior. Do not change provider settings, send customers messages or edit real rows to diagnose acceptance.

## Rollback / stop procedure

- Before release: any failed full/type/build/review/scope check stops publication/deployment; keep the isolated local branch for correction.
- After release: prefer a reviewed forward fix retaining the fresh server authorization and redaction. A Settings UI failure may remain temporarily unavailable while communications continue on unchanged handlers; never restore local credential caches or bypass server authorization.
- A blind promotion of b3b55c8 reopens anonymous credential reads/writes. It is not the default safe rollback. If a rollback is necessary, prepare/review an authenticated maintenance or corrected release for the settings/configuration slice, preserve callback/companion paths and obtain explicit owner approval. No alternate maintenance build is falsely claimed implemented by this task.
- If no authenticated recovery can be supplied, fail closed for affected private configuration and escalate the incident. Do not turn off protection, rotate credentials, restore database snapshots or reconnect services implicitly. There is no database migration to roll back and no device/provider coordination to undo for this patch.

## Evidence

GitNexus MCP unavailable; CLI impact authenticateEmail was not found in the index. Static callers and exact source-scope tests substitute; no graph coverage is claimed. Existing Supabase getUser/fresh-profile authorization and current React caller/credential-cleanup patterns were reviewed. Final frozen source: **363/363 tests, 24/24 files PASS (181.82s)**; TypeScript `tsc --noEmit` PASS; production Vite build PASS. Independent QA and security each returned scoped PASS after reviewing the final raw-envelope correction. Scope tests prove six excluded full files, unchanged callback and 31 unrelated action implementations, with named credential-projection/transport exceptions. No new hosted dependency, migration, package or deployment configuration change. Pattern scan found no private-key/PAT/modern privileged-key/AWS credential matches; this is not a guarantee about every possible secret format. No active local Git hooks found. Final origin/master fetch remains b3b55c82b31decba8a7bd66bdaa20b086a14d383.

Changed application files: api/settings.ts; api/whatsapp.ts; src/lib/settings/{server,projection,client}.ts; src/pages/{Settings,WhatsApp}.tsx. Tests: src/pages/{Settings,WhatsApp}.test.tsx; tests/settings-{containment,runtime,scope}.test.ts. Documentation: this delivery report, completed work packet and four context documents. No generated build artifacts are committed.

Evidence logs and independent reports are stored outside Git at artifacts/security-001a in the parent workspace: full-tests.log, type-check.log, build.log, qa-review.md, security-review.md, scope-proof.json and final-scope.json. Local checks use synthetic/mocked dependencies; no current hosted authorization, provider delivery or browser deployment acceptance is claimed. No push, merge, deployment, provider configuration change, SQL, credential rotation or customer-data operation occurred.

The local commit containing this report is the handoff identity (use `git log -1` on the named branch); the final response records its exact SHA. A self-referential commit hash is intentionally not embedded in its own contents. READY means locally reviewable and independently releasable, subject to the release gates above.
