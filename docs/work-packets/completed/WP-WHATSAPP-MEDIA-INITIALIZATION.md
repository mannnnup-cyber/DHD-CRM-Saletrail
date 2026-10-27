# WP-WHATSAPP-MEDIA-INITIALIZATION

## Metadata
Status: Done locally; live/release validation pending separate authorization. Priority: P1. Owner: inbox_usability_impl. Date: 2026-10-26.

## Objective / Business Background
Restore existing sendFile/sendMedia routing past a JavaScript temporal-dead-zone error. Customer uploads currently fail before reaching Evolution.

## Baseline / Preflight
Branch fix/whatsapp-media-initialization, worktree work/whatsapp-media-fix, origin/master baseline b3b55c8. Initially clean. Required AGENTS/context read in order. Existing trusted root node_modules junction only; no install or credentials read. CONTACT-001A untouched.

## Scope / Impact
Actual handler api/whatsapp.ts declares a const media helper between switch cases; jumping directly to the media cases skips its initializer. Minimal hoisted function declaration preserves the helper body and existing settings/provider/persistence behavior. Manual HIGH outbound-media impact warned to lead before edits. GitNexus upstream CLI impact attempted for executeEvolutionSendMedia with repository selection; the command stalled without output and was stopped. MCP impact/detect tools are unavailable. Manual HIGH caller tracing therefore governs; no index rebuild/install was attempted. No auth redesign, upload behavior expansion, provider setting change, real send or hosted mutation.

## Files / Acceptance
api/whatsapp.ts declaration only; tests/whatsapp-media.test.ts actual handler with mocked settings/database/provider. Prove both aliases reach exactly one expected media request, preserve payload/persistence, reject missing inputs/config and expose provider failure without success/persistence/retry. Type-check/build and independent review before any commit. Root owns call-feature assessment.

## Verification / Rollback
Actual-handler regression before fix:8/8 failures, including exact reported Cannot access executeEvolutionSendMedia before initialization payload. Same tests after declaration fix:8/8 PASS (1.57s). Scoped independent security PASS. Existing media routes remain unauthenticated; this is a HIGH release risk, not repaired by hoisting. Independent QA source PASS, final type-check PASS, production build PASS (2,782 modules,1m39s;1,298.47kB / gzip345.01kB). Initial full run305/308 across21 files (388.65s) had two10s beforeEach hook deadlines and one15s native-child deadline; the exact three-file serial rerun (one worker,60s hook timeout) passed14/14 (32.57s), including native email runtime3.432s. All308 distinct tests were covered by passing executions across these runs; this is not a single clean full-suite run. No source/test edits followed verification. GitNexus detect-changes unavailable; final git diff/status and diff --check scope verification used. No push/deploy/merge. Rollback by reviewed local revert of the declaration change. Existing legacy route authorization/validation limitations are unchanged and not claimed fixed. Local tests are not real WhatsApp delivery verification.
