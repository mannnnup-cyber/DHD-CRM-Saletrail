# WP-INBOX-FOUNDATION — Canonical Interaction/Event Foundation
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
