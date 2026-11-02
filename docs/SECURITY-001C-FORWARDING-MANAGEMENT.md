# SECURITY-001C — forwarding management authorization

Date: 2026-11-01 (America/Bogota). **Local implementation and verification COMPLETE; publication/release requires owner approval.**

Branch `fix/security-001c-forwarding`, baseline `37a7253910c8541fbc35a296ee3371b848f28051`. This is an independent browser-management patch, not the prerequisite-dependent callback/companion/recording packet. Root records the final local commit identity after full checks and reviews. No push, merge, deployment, hosted configuration/SQL/data change, credential rotation, real command or provider request was performed.

## Exact correction

- `api/whatsapp.ts`: only `sendForwardCommand` (POST) and `getForwardStatus` (GET) receive a new early method check and the existing `settingsOwner` guard before any settings/provider/forwarding data access. That guard verifies the live Supabase Auth identity, current active canonical role, modern server key and matching authentication/data project. Owner/manager access is required. Frontend role claims and spoofable headers do not grant access.
- Queued `device_commands.created_by` now contains the verified actor UUID. The current `EmailCaller` contract supplies `id`, `role` and `admin`; it supplies no email. No extra lookup or invented identity translation is introduced. Existing historical creator values remain unchanged.
- `src/pages/Settings.tsx`: exactly four existing forwarding/status fetches now use the existing same-origin `settingsFetch` current-Bearer helper. Existing forms, confirmation, queue routing, data payloads and polling interval remain unchanged.

No new helper, dependency, environment variable, migration, registry, organization requirement, callback header or mobile release is needed. All previously released SECURITY-001A protections and independent provider-redaction controls remain. The no-action callback, Android call ingest, device poll/ack, device registration/bindings, recording upload, WhatsApp message/media paths and other action implementations remain byte-identical to the baseline after removing this exact guard/attribution addition.

## Authorization evidence

Synthetic tests invoke the real handler and real existing authorization helpers with controlled Auth/database responses; no live provider or customer data is used.

| Caller / request | Expected and tested result |
|---|---|
| Missing, blank, malformed or array Bearer |401 before authentication/private database/provider effects |
| Expired/invalid Auth identity |401 before settings or forwarding effects |
| Inactive, missing, mismatched or unsupported canonical profile |403; no queue mutation or status disclosure |
| Assigned/unassigned rep role, including spoofed owner headers |403; no private forwarding result or queue effect |
| Profile lookup error, missing modern server key, auth/data target mismatch |503; no legacy/anonymous fallback |
| Wrong forwarding method |405 before authentication or private effects |
| Array/object action alias |400 before private effects |
| Owner / manager command creation |200 using existing routing, canonical actor UUID as creator, private/no-store; no provider HTTP call |
| Owner / manager status read |200 using existing shape, private/no-store, zero queue writes |

Both rep role names are denied. Current browser role/identity is rechecked on every protected request; a client-supplied `created_by` or `x-user-email` cannot replace the verified UUID.

## Verification

- Focused actual-handler, historical Settings/auth regression and preservation run:95 passed,1 failed out of96 across5 files. The sole failure was a newline in the new source-restoration test, not application behavior.
- Corrected preservation test rerun:14/14 PASS (2.67s). No application changes followed that test correction.
- New actual-handler authorization tests:15/15 PASS. Existing settings containment50/50, Settings UI6/6 and historical scope11/11 PASS in the focused run.
- Final exact-source full suite: **403/403 tests across28 files PASS**,94.47s. TypeScript and Vite production build PASS. Independent QA and security reviews PASS for the frozen limited diff. Normalized source/test hashes match the security review manifest. Scope and introduced-secret checks pass before the local commit. This is local readiness, not production acceptance.
- GitNexus MCP unavailable. CLI handler impact resolved the wrong WooCommerce handler and its LOW result was rejected; forwarding UI target was not found. Static critical impact and four direct callers were reported before edits. Exact source restoration and `git diff/status` provide scope proof, not graph coverage.

`tests/forwarding-scope.test.ts` reconstructs the baseline API by removing only the new guard and restoring only the previous creator expression. It also reverses only the four caller substitutions and checks twelve untouched files, including callback-adjacent/recording/settings/auth/UI and deployment configuration. The historical scope test permits only the two newly protected forwarding cases; no broad exception for machine or provider changes is added.

## Remaining risks and future acceptance

This patch does not secure the existing Android poll/ack/ingest paths, authenticate provider callbacks, establish device/org bindings, add durable command acknowledgement/idempotency, repair queue races or prove current phone operation. It deliberately preserves existing queue semantics and device lookup behavior; a registered device is not proof of an active phone. Historical command creator text remains mixed with new canonical UUID values; existing readers do not require it to be an email.

Current shared owner/manager business management is retained. No new assigned-rep browser management permission is introduced. Existing authentication warm-process limits apply;429 is a fail-closed response, not grounds for an anonymous bypass. These local tests do not establish hosted Auth, RLS, provider or device behavior.

After separate release approval, verify the precise reviewed PR/master and production deployment through native Git deployment, keeping webhook641005278 inactive. Live safe reads: anonymous/rep GET getForwardStatus must deny; owner/manager GET must load without a queue write. Verify the released Settings UI carries current Bearer headers, and monitor denial/loading errors without printing credentials or private status data.

Do not use a real sendForwardCommand request merely to test authorization: an incorrect deployment could still enqueue an executable phone command. Test all positive/negative mutation paths with synthetic actual-handler fixtures, then rely on exact deployed-code identity for that boundary. Real forwarding/USSD execution requires a separately approved controlled device test.

If regression occurs, retain SECURITY-001A/B and the forwarding authorization. Prefer a reviewed forward fix or temporary fail-closed forwarding-management maintenance. Blindly reverting this patch restores anonymous command creation/status exposure; no provider reconnect, credential rotation, database rollback or Android change is an implicit recovery step.
