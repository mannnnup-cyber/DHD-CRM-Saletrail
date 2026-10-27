# WhatsApp media correction and call feature assessment

Assessed 2026-10-26 (America/Bogota), production source baseline b3b55c82b31decba8a7bd66bdaa20b086a14d383. Fix branch: fix/whatsapp-media-initialization. CONTACT-001A remains isolated and unchanged. No release authorization is inferred.

## Media error

CONFIRMED: api/whatsapp.ts declares executeEvolutionSendMedia as a const initializer between switch cases. Dispatch to sendFile/sendMedia skips initialization and accesses the lexical binding in its temporal dead zone. The correction must initialize the helper before dispatch or use a hoisted declaration while preserving the existing provider payload, settings, response and persistence semantics. Regression tests must execute the actual handler with mocked transport; no customer file may be sent as a test.

CORRECTED LOCALLY: changed only the helper declaration from a const arrow to a hoisted async function, plus explanatory comment/closing syntax. Provider body and all existing routing/payload/credential behavior are unchanged. Eight actual-handler tests all failed with the initialization error before the fix, then passed after it (1.57s). Tests mock provider transport and persistence with synthetic data. Full verification is recorded below when complete. Local passing tests are not proof of live file delivery.

Independent scoped security review: PASS for the minimal correction. **Important release risk:** restoring the media path also restores functionality on an existing unauthenticated legacy send route. This is not security clearance for production. The new regression tests preserve existing routing behavior; they do not establish authorized-only sending. A separately scoped authentication/companion compatibility correction and release review should precede treating the messaging API as secure.

## Hosted evidence — aggregate reads only

Read-only project vatsonbvjkyzxqrnderr aggregate query returned:

| Store | Records | Latest stored call | Contact-linked | Rep-linked |
| --- | ---: | --- | ---: | ---: |
| cellular_calls | 15,692 | 2026-10-23 23:17:18.477 UTC | 3,365 | 11,458 |
| whatsapp_calls | 325 | 2026-10-05 20:07:09.413 UTC | 38 | 325 |

Three devices exist; latest heartbeat is 2026-10-23T23:45:55.709, stored as a timestamp without an offset in the aggregate result, so its timezone is not asserted. No names, phone numbers, message contents or customer rows were retrieved. Historical activity exists, but present-day capture, mapping and delivery are NOT VERIFIED. A quiet period, phone/app permissions, provider events or service availability could explain old timestamps; the cause is UNKNOWN without a fresh controlled check.

## Feature inventory and confirmed limitations

| Feature | Evidence and status |
| --- | --- |
| GSM call logging | Implemented companion ingestion, paginated history, rep/date/type filters and exact database counts. Historical writes VERIFIED by aggregate evidence. Fresh capture UNVERIFIED. |
| WhatsApp call history | Implemented webhook and companion ingestion plus UI history. Historical records VERIFIED; fresh Evolution session call capture UNVERIFIED. |
| Call button | WhatsApp.tsx initiateCall opens tel:+ and starts a local timer. It is a native dialer handoff, not an in-browser WhatsApp call. End Call clears the local overlay; it does not hang up the phone. Backend initiateCall explicitly returns unsupported for Evolution/Baileys. |
| Recording/transcription/coaching | Backend code exists, but deployed end-to-end operation is UNVERIFIED. RecordingSettings/CoachingDashboard use the known unsupported browser Supabase path. No Calls playback workflow or scheduled transcription worker was verified. Do not describe this as working coaching/recording. |
| Statistics | GSM counts use database COUNT. Duration aggregation remains row fetched and can be REST-capped; WhatsApp statistics cover only loaded calls (200/500 UI caps). Today/yesterday are rolling windows rather than Jamaica calendar days. |

## Prioritized repairs — assessment only, not implemented here

1. **HIGH: secure legacy call, recording and device APIs.** api/whatsapp.ts early authenticated routing covers label/unread operations, not all legacy call/device actions. Call-history routes lack caller/assignment checks; sendForwardCommand/getDeviceCommands/ackCommand lack the intended owner/device authorization. api/recordings.ts dispatch is POST-only but not authenticated; user/org/call IDs are caller supplied, and transcription can invoke a paid external service if configured. These are static confirmed missing checks, not a claim that carrier commands or recording disclosure were actually exercised. Require fresh owner/manager/rep authorization, per-device enrollment credentials, scope checks and provider ingress validation in a separately bounded packet. Do not break companion ingestion by simply applying browser JWT requirements to every webhook/device request. No public exploit or provider command was attempted.
2. **Verify sync health before adding call features.** Add last successful sync, phone heartbeat, stale-device warnings, event ingestion errors and provider-session status. Obtain a separately approved controlled test call after security containment; do not manufacture records to represent a real call.
3. **Correct call lifecycle and replay behavior.** Evolution CALL webhook inserts only if a provider ID is unseen; later answered/ended/duration events are skipped. Direction is forced inbound, absent status defaults missed and timestamps assume seconds. GSM ingestion can create interactions/count successful inserts even on ignored duplicates. Companion WhatsApp ingestion blindly inserts without a stable cross-source provider ID. Use stable source IDs, lifecycle updates and exactly-once timeline linkage without automatic identity merges.
4. **Repair identity and staff attribution.** Full JID digits are compared with last-ten contact normalization; LIDs must never be treated as phone numbers. CALL webhook resolves a contact for its timeline but does not update the call's contact_id. The UI Mine filter uses name/email prefix instead of verified user UUID. Shared phone values must never silently establish a person; preserve the approved distinct-contact policy.
5. **Make UI claims and statistics truthful.** Rename call controls to Open phone dialer and Close call panel, disable phone dialing for unresolved LIDs, remove the connection-style timer or label it as local elapsed time, normalize missed/rejected/completed semantics, use global database aggregates and explicit calendar timezone. Recording policy errors must fail closed rather than default to recording; review logging of raw call payloads and phone/file details.
6. **Useful next product improvement:** a missed-call follow-up queue with assigned owner, callback task, due time and resolved disposition; last-sync health beside it. Prefer this over more dashboards until capture/authorization are reliable. Callback tasks must not automatically place calls or message customers.

Recording-specific follow-up: uploadRecording writes audio_recordings/transcription_jobs but does not update cellular_calls.has_recording/recording_id; CoachingDashboard filters on has_recording, so an upload alone may not appear there. Queue insertion errors are not checked and the transcription job claim is not conditional across workers. This is source evidence only, not a live recording test. Protect access and recording policy first, then repair linkage and claims before enabling automatic processing.

## Safety and scope

Only the media initialization defect is being corrected in this packet. Call/security recommendations are not fixes or hosted verification. No real send, call, recording upload, transcription, device command, reconnection, hosted mutation/DDL, deployment, push or merge was performed. Existing customer records and provider settings remain unchanged. A separate release decision is required for the local media correction; the broader missing authorization is a release risk, not silently resolved by fixing initialization.

## Independent verification record

- Minimal actual-handler regression: before correction 8/8 failed with the reproduced initialization failure; after correction 8/8 PASS (1.57s). Provider and database transports are mocked; no credentials or customer data are needed.
- First independent full suite: 305/308 PASS across 21 files in 388.65s. All new media tests passed. Failures were two pre-existing UI beforeEach hook timeouts (10 seconds, ContactProfile and WhatsApp) and the unchanged inbox-runtime child process returning status null under its fixed 15-second deadline. These failures are retained, not reported as a clean full-suite PASS.
- Independent TypeScript: PASS, tsc --noEmit exit 0.
- Independent production build: PASS, exit 0; 2,782 modules, 1m39s; dist/index.html 1,298.47 kB / gzip 345.01 kB.
- Exact three failed files rerun serially with worker min/max 1 and CLI hookTimeout 60 seconds: 14/14 PASS, 3/3 files, 32.57s. The unchanged native email child completed in 3.432s. All 308 distinct tests were covered passing across the original run and targeted retry; this is not a single clean full-suite run. No timeout setting in shipped tests was changed to hide a failure. An initial retry command's worker configuration conflict occurred before test execution and was corrected in the invocation only.
- Independent scoped functional QA source review: PASS. No additional application/test changes followed final verification.
- Independent scoped source security: PASS for the declaration-only correction; HIGH existing unauthenticated media/call/device/recording routes remain documented release risks. Independent call inventory is static source assessment plus the aggregate reads above, not real calling/recording validation.
