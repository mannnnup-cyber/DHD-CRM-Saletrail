# SECURITY-001C — independent forwarding management authorization

Date: 2026-11-01 (America/Bogota). Status: In Progress locally.

Branch `fix/security-001c-forwarding`, baseline `37a7253910c8541fbc35a296ee3371b848f28051`. One implementation owner, separate root-coordinated QA/security review. No push, merge, deploy, hosted operation, real command, provider change or credential rotation.

## Scope

Require the existing fresh active owner/manager authorization for browser `sendForwardCommand` (POST) and `getForwardStatus` (GET) before private database/settings/provider effects. Attribute queued commands to the canonical verified actor UUID, never a caller-supplied email/header. Update only the existing Settings forwarding fetches to the current Bearer transport. Preserve the live SECURITY-001A/B controls and all callback, Android call/poll/ack, device binding, recording, media and unrelated application behavior.

No new environment variable, machine registry, organization mapping, schema or deployment configuration is permitted. Existing command validation/routing/acknowledgement behavior remains; this patch does not solve phone-side acknowledgement replay or queue concurrency.

## Impact / verification

GitNexus MCP unavailable. CLI impact for handler resolves the wrong WooCommerce handler; its LOW result is rejected. Forwarding UI target is absent in the index. Static impact is CRITICAL: command creation may cause phone-side forwarding changes. Direct callers are four Settings fetch sites. Root warned before implementation.

Actual-handler denial/method/role/creator tests, narrow caller preservation, exact callback/machine/unrelated source preservation, existing auth regression tests, full suite, TypeScript, build and independent QA/security are release gates. Use only synthetic mocks; never invoke a real forwarding command as acceptance. Root owns final full checks and local commit.

## Local completion

Final403 tests/28 files, TypeScript and production build PASS; independent QA/security PASS. Exact reviewed source hashes retained. Local commit only; owner approval required before publication/release. See docs/SECURITY-001C-FORWARDING-MANAGEMENT.md.
