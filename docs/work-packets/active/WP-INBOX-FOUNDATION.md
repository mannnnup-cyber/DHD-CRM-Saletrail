# WP-INBOX-FOUNDATION — Canonical Interaction/Event Foundation
## Current review — 2026-10-14 (supersedes historical baseline and blanket dependencies below)

Status: Review. This authorization covers plan/baseline refresh, not live Inbox implementation or deployment.
Authoritative checkout: `C:/Users/Administrator/DHD-CRM-Saletrail`.
Review worktree: `C:/Users/Administrator/Documents/Codex/2026-10-12/do-you-have-access-to-my/work/inbox-review`.
Branch: `docs/inbox-foundation-refresh`; source baseline: `9502f46a1a68b6b6ec388e9d097178f40dafb420` (origin/master).
The old `dhd crm sale trail` root below is historical and explicitly forbidden by current AGENTS.md; do not use it.

### Implemented foundation and missing pieces

- `src/lib/inbox/types.ts` defines CanonicalInteraction, ContactResolutionOutcome and IdempotencyResult.
- `src/lib/inbox/adapter.ts` defines SourceAdapter, three idempotency helpers and resolution outcomes; it does not implement source normalize adapters, persistence or an Inbox UI.
- `src/lib/inbox/contract.test.ts` has 11 executable Vitest tests. Search finds no production consumers of these helpers.
- Current contract combines message/email with call/task/deal/note in one type; a discriminated messaging/business-event boundary remains missing.
- Truthy provider IDs are converted with String(), accepting malformed objects; email IDs lack mailbox/account scope. Resolution assumes supplied candidates are authoritative; it performs no identity lookup.
- `api/email.ts` has list/threads/thread plus sync/send/reply/mutations, but its handler has no caller JWT/role gate and uses wildcard CORS. Existing user-management auth does not secure those actions.
- `api/social.ts` exposes provider status/accounts/analytics, not a verified inbound message adapter; provider Authorization is not caller authorization.
- `api/contacts.ts`, existing interactions and email persistence can inform future mapping. Source inspection does not verify current production schema/RLS state.

### Smallest next implementation slice: synthetic email projection

Implement only pure modules under `src/lib/inbox/` and synthetic fixtures/tests. No route, API fetch, provider call, actual customer data, storage write, AI, contact creation, send/reply or WhatsApp change.
Project a documented minimal email fixture into a messaging-only canonical result with content references, timestamp, direction, mailbox/provider identity and contact-resolution evidence supplied by the caller. Separate business events using an explicit discriminator. Reject invalid inputs with structured outcomes rather than throwing or inventing identifiers.

Acceptance criteria:
1. Runtime validation rejects absent/object/blank IDs, invalid timestamps/directions and unsupported types; unknown metadata cannot leak into the projected result by unrestricted copying.
2. Provider + mailbox/account + stable external message ID define deterministic collision-safe identity; replay yields the same key, distinct mailboxes/providers do not collide, missing identity is explicitly unsafe. No timestamp-only fallback.
3. Projection retains unresolved/ambiguous outcomes with no invented contact ID; verified/unique-normalized matching requires explicit authoritative evidence.
4. Messaging records and business events are distinguishable; call/task/deal events cannot appear as Inbox messages by default.
5. Pure fixture tests cover malformed inputs, replay/collision, timestamp normalization and all resolution outcomes; existing 11 contracts are preserved or deliberately updated with documented reasons.
6. npm test, npm run test:contract, npm run type-check and npm run build pass; independent QA reviews the slice and security reviews any privacy-sensitive contract change.

### Gates by actual exposure

- Local synthetic slice: no webhook/RLS/provider rotation or live AI prerequisite blocks pure code. Required gates are scoped impact analysis, synthetic privacy-safe fixtures, deterministic validation and independent review. This is a proposed slice, not an implemented or deployed feature.
- Live read-only email Inbox: server-side caller authentication/active role and row/contact ownership authorization, approved field minimization/retention, verified production schema/RLS, pagination and safe projection/deduplication are blockers. Protect read endpoints; do not treat RLS as sufficient when using privileged clients. Define applicable rate limits and UI rendering/CSP controls before activation.
- Live inbound provider/WhatsApp ingestion: provider authenticity, replay/deduplication, callback delivery evidence and scoped retention/rate limits additionally apply. WhatsApp remains explicitly on hold; omit its activation from an email-only slice.
- AI/call intelligence: privacy-aware audit/retention and device/transcription access gates apply only when these are included. Autonomous actions additionally require explicit authority and human approval.
- Deferred legacy key exposure remains a recorded P0; this review neither verifies invalidation nor changes owner authorization. Any live feature must explicitly review/accept unresolved relevant risks; local tests do not resolve them.

Current command evidence is recorded in WP-MAINTENANCE-BASELINE. Historical planning below is retained for provenance; claims about verified live tables, line counts and all A–F prerequisites are not fresh verification. The next slice's mailbox/provider/stable-ID identity explicitly supersedes the historical provider + external ID + occurred_at recipe: mutable timestamps must not split replay identity. Existing WhatsApp helper behavior is merely observed, not approved for new live ingestion.

## Historical planning record
# Status: Planning ONLY — no product change; WP-001 preserved
# Branch: planning/phase1-packets (from verified origin/master 6f0ef85)
# Preflight: PASS
# Note: Canonical contract design; NO WhatsApp webhook diagnosis/fix (WP-001 separate).

## Repository Baseline (recorded via mandatory preflight against `6f0ef85`)
- Authoritative Git Root: `C:/Users/Administrator/dhd crm sale trail/DHD-CRM-Saletrail`
- Baseline origin/master SHA: `6f0ef857ac7e57d56904d1e992f43e5af95ce60d`
- Branch: `planning/phase1-packets`
- HEAD: 0bd6ec5 (pre-refinement planning branch)
- Divergence vs origin/master: 1 ahead / 0 behind
- Previous planning SHA (before refinement): 0bd6ec5
- Worktree: single (verified; no nested .git conflict)
- Preflight Verdict: PASS
- Source-evidence: `git ls-tree -r origin/master --name-only`; `git grep <term> origin/master`; `git show origin/master:<path>` — not working-tree assumption.

## Objective
Design the minimum canonical interaction/event contract that can support Unified Inbox (messaging channels separate from business events), Contact Timeline / AI Brain / Action Queue (business events), without assuming DB migration until existing schema is verified.

## Inspection of Current Implementations (verified against `origin/master` objects — not working tree alone)
- **WhatsApp:** `api/whatsapp.ts` (2928 lines) — webhook receiver ~163-555; syncEvolutionMessages 1853-2059; `WHATSAPP_ASSESSMENT.md` exists; `WP-001-whatsapp-webhook-failure.md` active (separate — do NOT diagnose here).
- **Email:** `api/email.ts` (113-122 / 156-158 openai gpt-4o-mini call; AI pipeline).
- **Social:** `api/social.ts` — active.
- **Contacts:** `api/contacts.ts`; DB tables `contacts` verified.
- **CRM / Interactions:** `api/crm.ts` (719-734 call_transcripts + sentiment); DB `calls`, `interactions`, `call_transcripts`, `transcription_jobs`.
- **WooCommerce:** `src/pages/WooCommerce.tsx` — webhook docs + legacy SaleTrail refs.
- **Recording / Transcription:** `api/recordings.ts` (478 lines) — Companion upload + Whisper (`whisper-1`) + transcription_tables.
- **Tasks:** `api/tasks.ts`; DB `tasks`.
- **Users / Companion:** `api/users.ts` (companion_installed); `src/components/CompanionConnect.tsx`; `src/pages/CompanionApp`.

## Canonical Contract Design (minimum; planning only)
`Source → Normalize → Contact Resolution → Interaction/Event`

**Separation (explicit, not blended):**
- **Messaging Channels → Unified Inbox:** WhatsApp (Evolution/GreenAPI), Email (`api/email`), Social (`api/social`), any future channel.
  - Input: raw message (text/voice/media) from source.
  - Normalize: extract sender identifier, timestamp, content type, channel tag.
  - Contact Resolution: map sender to `contacts` table (existing; verified).
  - Interaction/Event: create `interactions` / `events` record linked to contact + channel.
- **Business Events → Contact Timeline / AI Brain / Action Queue:** separate pipeline, does NOT blend with messaging raw content.
  - Input: resolved interaction + derived context (call transcript, email sentiment, CRM deal update, task status).
  - Normalize: business-event schema (type, outcome, related entities).
  - Contact Resolution: already done at interaction layer (reuse, do not duplicate).
  - Interaction/Event: record event in timeline; trigger AI Brain / Action Queue if conditions met.

**Reuse / Extend / New Structure Assessment (verified against existing schema):**
- `contacts`, `interactions`, `calls`, `tasks`, `emails`, `call_transcripts`, `transcription_jobs`, `users`: EXIST — reuse; do NOT require migration for base Inbox pipeline.
- New structures likely needed (plan only — not implemented here): unified inbox message store (linking raw message to interaction); AI Brain event log; Action Queue table; potential `events` normalization table.
- DB migration NOT assumed necessary for planning; will be verified before any implementation (preflight step 9: `git ls-tree` / `git grep` against `origin/master` plus schema verification).

## Canonical Contract — Full Field Definition (planning, not implemented)
Fields: source/channel; provider; external/provider ID; nullable contact ID; direction; message/event type; occurred_at; received_at; content/content reference; media references; related entity type/ID; raw-source reference; metadata; processing state; deduplication/idempotency key; authority/approval; audit reference (hash/provenance only; raw content retained only under approved retention).

Universal (all): source_identifier, occurred_at, direction, event_type, contact_id (nullable), content_ref, metadata, processing_state, idempotency_key, audit_ref.
Messaging-only (Inbox): provider, provider_external_id, message_format, media_refs, raw_source_ref, received_at.
Business-event-only (Timeline/AI/Action): event_subtype, business_entity_type, business_entity_id, outcome, related_interaction_id, approval_state, authority_level.

## Contact Resolution Service (reusable stage — explicit outcomes only)
- Matched existing contact (verified identity).
- Confidently matched through normalized identity.
- Unresolved.
- Ambiguous / requires human resolution.
No invented match; always record resolution method and confidence.

## Idempotency / Deduplication
- Webhook retries: idempotency_key derived from provider + external_id + occurred_at.
- Sync/replay jobs: same; duplicate events rejected; first-write wins.
- No duplicate `interactions` / `events` created for same raw message.

## Persistence / Data Flow Findings (read-only; adapter/projection possible initially)
Existing structures verified on `origin/master`: `contacts`, `interactions`, `calls`, `tasks`, `emails`, `call_transcripts`, `transcription_jobs`, `users` (DB); `api/whatsapp.ts` (webhook/reception); `api/email.ts`, `api/social.ts` (reception); `api/crm.ts` (interactions/calls); `api/recordings.ts` (transcription/Companion). Canonical layer can initially project over these without new tables if mapping is clean; new unified store / AI event log / Action Queue proposed only when proven necessary.

## Dependencies
- WP-SEC-FOUNDATION (prerequisites (A)-(F) — webhook auth + AI audit + device auth + rate limit/CSP + PII + RLS containment at 38/38).
- WP-ARCHITECTURE-REVALIDATED / WP-AGENT-PREFLIGHT (framework; preflight inheritance).
- WP-001 (preserved; WhatsApp webhook behavior NOT altered here; if Inbox integration consumes WhatsApp output, WP-001 result feeds into this, not this fixing WP-001).
- Downstream (not started here): WP-AI-BRAIN, WP-CALL-INT.

## Potential Conflicts Between Packets
- WP-SEC-FOUNDATION prerequisites (A)-(F) must be satisfied before WP-INBOX-FOUNDATION implementation; planning accepted this sequencing.
- WP-REBRAND visible changes should not break `api/contacts`, `api/crm` paths; technical identifiers preserved by default (see WP-REBRAND).
- WP-INBOX and WP-AI-BRAIN share the `Source → Normalize → Contact Resolution` layer; interface design must agree (not yet implemented — planning defines contract).

## Expected Files / Modules (inspection / planning — no edit)
- `api/whatsapp.ts`, `api/email.ts`, `api/social.ts`, `api/contacts.ts`, `api/crm.ts`, `api/users.ts`, `api/recordings.ts`, `api/tasks.ts`
- `src/components/CompanionConnect.tsx`, `src/pages/CompanionApp`, `src/pages/WooCommerce.tsx`
- `docs/work-packets/active/WP-001-whatsapp-webhook-failure.md` (preserved; read-only reference only — no fix/diagnosis)
- DB tables: `contacts`, `interactions`, `calls`, `tasks`, `users`, `deals`, `invoices`, `emails`, `call_transcripts`, `transcription_jobs`

## Acceptance Criteria (planning verification)
1. Canonical contract defined with Source/Normalize/Contact/Event separation.
2. Messaging Channels vs Business Events explicitly split.
3. Existing implementations inspected against `origin/master`; reuse/extend/new identified.
4. WP-001 untouched (no diagnosis/fix of WhatsApp webhook).
5. No DB migration assumed; verification step documented.
6. Security prerequisites (A)-(F from WP-SEC-FOUNDATION) referenced.

## QA Requirements
- QA verifies: no `src/` or `api/` edit; `WP-001.md` unchanged; contact-resolution logic consistent with `api/contacts.ts`; contract documented; `follops-lead.md` preflight inheritance recorded.

## Security Review Required: YES (before any Inbox production expansion — reference WP-SEC-FOUNDATION prerequisites).

## Rollback Strategy
Not applicable (no mutation). If contract changes required after implementation start: revert to `6f0ef85` planning baseline; re-verify with `git ls-tree` / `git grep`.

## Implementation Report (to be filled upon PA approval — planning only now)
- Work Packet: WP-INBOX-FOUNDATION
- Branch: `planning/phase1-packets`
- Files Changed (this file only): `docs/work-packets/active/WP-INBOX-FOUNDATION.md`
- Summary: Canonical interaction/event contract planned; existing implementations inspected; no DB migration assumed; WP-001 preserved.
- Tests/Build: N/A (planning)

Co-Authored-By: Claude Code <noreply@anthropic.com>
