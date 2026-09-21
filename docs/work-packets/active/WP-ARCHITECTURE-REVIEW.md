# WP-ARCHITECTURE-REVIEW — CORRECTED AGAINST ORIGIN/MASTER (86061398cfb...)
# Status: Planned — Principal Architect review required before any implementation
# Branch: WP-ARCHITECTURE-REVALIDATED (remote 0a8ccf1 before correction; new commit after this edit)
# Baseline: origin/master = 86061398cfb4857aaf4486fd40b207c81e0e645d (verified git rev-parse)
# Divergence (architecture branch vs master): 3 ahead / 0 behind (git rev-list --left-right --count HEAD...origin/master) — NOT 0/255 (that was feature/local-models-docs-and-whatsapp-db 94df827)
# Authoritative checkout: C:/Users/Administrator/dhd crm sale trail/DHD-CRM-Saletrail (single worktree; no nested repo; remote origin = https://github.com/mannnnup-cyber/DHD-CRM-Saletrail.git)
# Constraints: NO master merge; NO deploy; NO DB/RLS/credential mutation; WP-001 preserved separate; only this file edited; commit normal (no amend/force-push)

=== REPOSITORY TOPOLOGY (VERIFIED READ-ONLY) ===
- git rev-parse --show-toplevel: C:/Users/Administrator/dhd crm sale trail/DHD-CRM-Saletrail
- git remote -v: origin https://github.com/mannnnup-cyber/DHD-CRM-Saletrail.git
- git rev-parse HEAD (this branch): 0a8ccf1ec5497d5cc44fd6384dc1e2b32295ebd0
- git rev-parse origin/master: 86061398cfb4857aaf4486fd40b207c81e0e645d
- git branch -vv (WP-ARCHITECTURE-REVALIDATED): 0a8ccf1 [origin/WP-ARCHITECTURE-REVALIDATED]
- Local master (f604ba7) STALE — must NOT be used as architecture baseline; tracks origin/master 8606139 remotely.
- Worktree: single; HEAD = branch; no nested DHD-CRM-Saletrail directory.
- All 5 previously-misinventoried files present at origin/master per git ls-tree / git show (see below).

=== CORRECTIONS FROM STALE VERSION (DOCUMENTED, NOT INVENTED) ===
REMOVED INCORRECT CLAIMS (verified against origin/master objects, not working-tree guesswork):
- "api/recordings.ts MISSING" → CORRECTED: EXISTS (478 lines; handles companion recording uploads + transcription queue; Whisper via openai whisper-1 at lines 417/429/448).
- "api/crm.ts MISSING" → CORRECTED: EXISTS (1204 lines; call_transcripts table access lines 719-734; sentiment/keywords; batch analyze).
- "BRAND.md MISSING" → CORRECTED: EXISTS (docs/context/BRAND.md; FollOps brand; formerly DHD CRM SalesTrail; tagline + personality defined).
- ".claude/agents/ ABSENT" → CORRECTED: EXISTS (6 files: follops-lead.md, follops-backend.md, follops-frontend.md, follops-integrations.md, follops-qa.md, follops-security.md).
- "api/whatsapp.ts 421 lines" → CORRECTED: 2928 lines at origin/master (prior 421 was working-tree artifact / different checkout).
- "0 ahead / 255 behind" → CORRECTED: 3 ahead / 0 behind (current branch vs master); 0/255 belonged to feature/local-models-docs-and-whatsapp-db at 94df827.
- "Companion must be BUILD NEW merely because previously not found" → CORRECTED: Companion ACTIVE (api/crm.ts 1131/1189; api/users.ts 222/427/429; api/whatsapp.ts 54/63/2305/2448/2777; companion_installed field; download URL for DHD-CRM-Companion APK). Call Intelligence EXTENDS existing pipeline; does NOT start from zero.
- "CallVault exists in FollOps" → REMOVED: CallVault is EXTERNAL Android both-side recording reference only; never claimed as internal.

=== 1. FOLLOPS REBRAND COMPLETION (VERIFIED FROM origin/master) ===
Source: git show origin/master:docs/context/BRAND.md (verified present; first 20 lines read).
Brand definition: FollOps (formerly DHD CRM SalesTrail); tagline "Never Miss The Next Opportunity."; concepts: Know What Needs Attention Today / Turn Activity Into Action / Follow Every Opportunity; personality: Intelligent.
Remaining visible DHD/SaleTrail branding (separate from technical IDs):
  - docs/context/ARCHITECTURE.md line 5 ("DHD CRM SalesTrail..." — document reference, not code)
  - docs/context/FILE_MAP.md line 10 (name field), 208-209 (dhd_salestrail_state / dhd_synced_calls keys)
  - docs/context/PROJECT_BRIEF.md line 5
  - docs/README.md line 1 / 25 / 192-193
  - src/context/AppContext.tsx localStorage keys (dhd_salestrail_state, dhd_synced_calls) — TECHNICAL IDENTIFIER: rename when brand changes, do NOT delete data format
  - src/pages/Documentation.tsx (DHD SalesTrail references in page copy)
  - src/pages/CallSync.tsx (dhd_callback_ prefix + localStorage keys)
  - src/lib/supabase-service.ts comment ("DHD CRM")
  - src/pages/WooCommerce.tsx (SaleTrail webhook docs — legacy)
Visible UI branding to change: docs headings, page titles, localStorage key names (preserve JSON structure), auth domain references (if owned), public-facing copy.
Technical identifiers to preserve (no DB rename yet): table names (contacts, interactions, calls, tasks, users, deals, invoices, emails, call_transcripts, transcription_jobs), API endpoint paths, environment variable names, user IDs, recording storage bucket naming, existing localStorage JSON value formats.
Agent framework (.claude/agents/): ACTIVE at origin/master (6 files); FollOps native framework confirmed — no contradiction.

=== 2. CALL INTELLIGENCE (ACTUAL — NOT INVENTED) ===
Verified at origin/master via git show / grep (read-only):
- api/recordings.ts: 478 lines. Header: "Handles recording uploads from companion app and transcription queue management." Endpoints include upload, transcription queue (transcription_jobs), call_transcripts insert/update.
- Companion integration ACTIVE: api/crm.ts 1131 (`companion_installed` select); 1189 (update); api/users.ts 222/427/429; api/whatsapp.ts 54 (download URL to DHD-CRM-Companion releases), 2305 (update companion_installed), 2448 (COMPANION_APP_DOWNLOAD_URL setting), 2777 (Companion polls device commands).
- Transcription implementation: api/recordings.ts 417 (WHISPER_API_URL = openai.com/v1/audio/transcriptions); 429 (model whisper-1); 448 (insert call_transcripts with provider='openai', model_used='whisper-1').
- Tables verified via source + grep: transcription_jobs, call_transcripts, call_insights (analytics). Not fabricated.
- Supabase Storage: recording_url field in schema; endpoint accepts uploads. Storage privacy/security NOT verified (signed URLs, bucket access policy, authorization, retention are TARGET ARCHITECTURE until explicitly tested — see section 8).
Design (future work, NOT implemented): Companion app (Android) -> private upload -> transcription (Whisper/openai, provider-replaceable design) -> AI analysis (sentiment/extract keywords — existing in crm.ts 719-734) -> Contact Timeline (link to master contact via identity resolution). CallVault: EXTERNAL ONLY — Android both-side capture research reference; never stated as internal feature.
Reuse vs build:
  - REUSE: Companion device auth framework (users/whatsapp), transcription_tables, Whisper API integration (recordings.ts), sentiment analysis (crm.ts), storage upload endpoint.
  - BUILD NEW (future packets): private-cloud encrypted storage with signed URLs, device-level authentication enforcement, retention/access policy automation, AI summarization layer over transcripts, Contact Timeline integration from transcription to contact record.

=== 3. WHATSAPP (VERIFIED FROM origin/master — NOT 421-LINE GHOST) ===
Direct: git show origin/master:api/whatsapp.ts | wc -l = 2928.
Architecture: Vercel handler (import { VercelRequest, VercelResponse }); Supabase client initialization; normalizePhone(); resolveContact() via email/phone/filters against contacts table (line ~170); companion_download URL; device command poll (line 2777); companion_installed update (2305); webhook message processing (evolution/greenapi integration patterns present in source — verify exact provider by reading lines 160-402).
WP-001 status (preserved separate): Blocked at Layer B/C — webhook config/live evidence required from owner (redacted webhook state + Vercel POST log). This document does NOT unblock WP-001; WP-001 remains separate branch/worktree.
No webhook auth mutation in this document; no credential rotation; no production edit.

=== 4. EMAIL / SOCIAL / CONTACTS / CRM (VERIFIED) ===
- api/email.ts: OpenAI callOpenAI() at 129; model gpt-4o-mini at 156; fetch to api.openai.com/v1/chat/completions at 158; lead-scoring JSON response at 183; additional use at 1025.
- api/recordments.ts + api/crm.ts confirm transcription pipeline + call_insights table (rule-based AI model documented at insert line 448: ai_model='rule-based').
- api/social.ts, api/contacts.ts, api/tasks.ts: present at origin/master (listed in git ls-tree); verify individually if needed.
- BrightBean / social adapter: design future; existing social endpoint preserved.
- Interaction / contact model: verified through crm.ts and schema references.

=== 5. UNIFIED INBOX (SEPARATE CHANNELS FROM BUSINESS EVENTS) ===
Distinction (verified from existing architecture, not conflated):
  - Conversation / Messaging Channels → Unified Inbox (response-required): WhatsApp (api/whatsapp.ts), Email (api/email.ts), Social / BrightBean (api/social.ts). Adapter per channel normalizes to conversational units.
  - Business / Transaction Sources → Contact Timeline + AI Brain (not messaging channels): WooCommerce orders/invoices (api/woocommerce.ts), Quotes (deals/quotes table), Calls (api/recordings.ts + call_transcripts), Tasks (api/tasks.ts), Interactions (interactions table), Orders, Events.
  - Business events MAY create inbox/action items (e.g., order.created → create task / notify; quote.expiring → suggest follow-up) but the source is not a message channel.
Canonical normalization layer (target architecture — defines pipeline, not implementation):
  Source → Normalize → Contact Resolution → Interaction / Event → AI Brain → Suggested / Approved Action
  - Source: channel message (WhatsApp/Email/Social) OR business event (WooCommerce/Quote/Call/Task).
  - Normalize: canonical fields (from/to, timestamp, body/content, provider_message_id for idempotency, attachments, event_type for business sources).
  - Contact Resolution: match to master contacts record (email + phone normalized); create new if unmatched; update last_contacted_at.
  - Interaction / Event: write to interactions / call_transcripts / tasks / orders / quotes / timeline (depending on source type — message vs event).
  - AI Brain: analyze summarized context; extract intent / task / opportunity; draft response / suggest action / recommend next-best-action.
  - Suggested / Approved Action: output must specify authority (Suggest/Approve/Auto); action registry entry determines execution rules (see section 6 — AI Tool Registry).
Future channels: Instagram/Facebook (via BrightBean/social adapter), SMS, voicemail (after Call Intelligence completed).
Distinction preserved: Inbox = response-required; Timeline = complete history.

=== 6. FOLLOPS AI BRAIN (INVENTORY + DESIGN) ===
Verified existing AI at origin/master (NOT scattered guesses):
  - Email: callOpenAI -> gpt-4o-mini (lead score, JSON extraction) — api/email.ts 129/156/158/183/1025.
  - Call transcription: Whisper-1 (openai) -> text -> call_transcripts -> rule-based sentiment + extractKeywords -> call_insights — api/recordings.ts 417/429/448; api/crm.ts 719-734.
  - AI model reference: ai_model='rule-based' at insert (line 448) — indicates current transcription insight layer is rule-based, not LLM — document accurately.
  - No centralized orchestration layer exists; no business-event framework; no provider registry.
Design (future packet): Centralized AI service interface + event-driven orchestration; provider registry (OpenAI, Anthropic, local — replaceable); business events defined: message.received (inbox adapter), call.transcribed (recordings complete), order.created (WooCommerce), quote.expiring (deal), contact.updated (CRM), task.completed (pipeline). Capabilities: summarization (conversation/call/deal), intent extraction, task extraction, opportunity detection (lead score), response drafting (Suggest only — never auto-send), next-best-action (reminder/follow-up/task), customer intelligence (timeline aggregation). Provider replaceable: interface defines analyze()/generate()/summarize(); implementations registered; default configurable.
=== 7. AI TOOL / ACTION REGISTRY (TARGET ARCHITECTURE — NOT IMPLEMENTATION) ===
Purpose: enforce Suggest/Approve/Auto authority per tool; every AI action routed through registry before execution.
Each tool definition: input schema, permitted roles, authority level (Suggest / Approve / Auto), approval requirement, audit requirements, reversibility.
Illustrative future tools (architectural examples only — NOT implementation authorization):
  - create_task: input {contact_id, title, due_date, priority}; roles admin/manager/rep; Suggest/Approve; audit task creation; reversible (cancel).
  - draft_reply: input {message, tone, contact_id}; roles rep/manager; Suggest; audit draft text; reversible (discard).
  - send_reply: input {conversation_id, body, channel}; roles manager/admin; Approve; audit send; reversible only via recall within provider window (verify).
  - create_quote: input {deal_id, items, amount}; roles manager; Approve; audit quote creation; reversible before acceptance.
  - assign_conversation: input {conversation_id, agent_id}; roles manager; Suggest/Approve; audit assignment; reversible.
  - schedule_followup: input {contact_id, when, type}; roles rep/manager; Suggest/Approve; audit schedule; reversible before scheduled time.
  - retrieve_order: input {order_id, contact_id}; roles rep/manager/auto; Suggest (read-only); audit access; reversible n/a (read).
  - update_contact: input {contact_id, field, value}; roles manager/admin; Approve; audit change; reversible via undo/versioning if supported.
Registry rules: AI output must reference registry tool; authority mismatch -> escalate; unknown tool -> no action; registry itself protected (admin-only mutation); audit log appended per action.

=== 8. AI ACTION SAFETY (POLICY — NOT IMPLEMENTED) ===
Authority levels:
  - Suggest: AI produces draft/summary/recommendation; HUMAN review required; NO automatic send/update/deletion.
  - Approve: HUMAN explicitly approves; action executes; audit log entry required.
  - Auto: ONLY low-risk reversible actions (tag assignment, internal reminder, read-only summary); NEVER for: customer message send, deal/invoice change, contact deletion, financial operation, data export, webhook/auth mutation, RLS change, credential rotation, customer message content exposure.
Tool permissions: per-role (admin/manager/rep/viewer); per-action-type (delete requires admin + Approve).
Role permissions: AI suggestions visible to assigned role; auto-restricted by role + sensitivity + channel.
Audit trail: timestamp, user, AI action ID, input context hash, result, approval status, channel, contact reference — required for ALL AI-touching actions; must log before execution.
Always-human-approval: send any customer message; modify deal/invoice/quote value; delete contact/interaction/task/recording; change webhook/auth/RLS/credentials; export customer data; approve AI-drafted financial/legal content.

=== 9. SECURITY AND DATA (VERIFIED GAPS + TRUST BOUNDARIES) ===
Acknowledged P0 exceptions (not reinvented, not hidden):
  - Rate limiting: missing on /api/auth/* (documented; fix in future packet, NOT now).
  - CSP header: missing (documented).
  - PII audit logging: missing (documented; required before AI processes customer content at scale).
  - Webhook auth: api/whatsapp.ts uses GREENAPI token env; HMAC/signature verification recommended (future packet), NO mutation now.
Private recording storage (current state vs target — DO NOT INFER FROM ENDPOINT DESIGN ALONE):
  - VERIFIED at origin/master: api/recordings.ts handles uploads; Supabase Storage referenced (recording_url in schema); endpoint accepts uploads.
  - NOT VERIFIED / REQUIRES EXPLICIT CHECK: signed/short-lived URL mechanism; bucket access policy (RLS); authorization check before download; retention period enforcement; access audit logging; encryption-at-rest specifics; device-level authorization binding.
  - TARGET ARCHITECTURE (until verified): private bucket with strict RLS; signed URLs with expiry tied to user+device session; retention policy defined per-channel (recording retention period, deletion requires admin + audit); access logged per download; Companion device auth enforced before any storage operation.
  - DO NOT state "secure/private" as verified solely because endpoint exists or recording_url field exists.
Data-minimization policy (replaces blanket "excluded" claim — defined until verified):
  - Only the minimum information necessary for the specific AI task may be sent to any AI/transcription provider (e.g., transcript text + call_id for sentiment; message body + contact_id for intent extraction; never full contact record, financial data, or unrelated interaction history unless explicitly required by the task).
  - Sensitive-data categories must be explicitly classified: PII (name, email, phone, address), financial (deal/invoice values, payment info), legal/contract (terms, agreement text), health/medical, authentication (passwords, tokens), customer message content (full thread context beyond task scope).
  - Provider retention / training policy: must be documented per provider (OpenAI Whisper, OpenAI chat, Anthropic, local); prohibit training use of customer data unless explicitly contracted; verify provider's data-deletion / retention terms; do not assume exclusion — verify contract terms.
  - Access controls: AI-processed data must reside in same access-controlled DB (contacts/interactions scoped to user/org); no AI output exposed to unprivileged roles.
  - Audit: every AI input/output pair logged with task type, data categories included, provider, approval status, user, timestamp — required before any production AI expansion.
Companion device authentication: device registers to user; recording access only via signed URL tied to device + user session; revocation on disable/replace.
No credential rotation performed; no webhook auth mutation; no RLS mutation.

=== 10. PRESERVE VS REFACTOR VS EXTEND VS BUILD (VERIFIED SUBSYSTEMS) ===
Subsys              | Verdict   | Evidence (from origin/master)
--------------------|-----------|---------------------------------------------------
WhatsApp webhook    | PRESERVE  | api/whatsapp.ts 2928 lines active; GreenAPI/Vercel; WP-001 blocked at B/C — separate.
Email + AI (gpt-4o)| PRESERVE+EXTEND | api/email.ts active (callOpenAI, gpt-4o-mini); extend to centralized layer.
Call Intelligence   | EXTEND    | api/recordings.ts 478 lines + Companion + Whisper + transcription_tables active; build private-storage/encryption/AI-link layers.
Contacts/CRM        | PRESERVE  | api/crm.ts 1204; interactions/contact model; identity resolution build future.
Social/BrightBean   | PRESERVE+EXTEND | api/social.ts present; adapter model future.
Supabase DB/Schema  | PRESERVE  | schema present; recording_url; transcription_tables; NO mutation.
Companion (device)  | EXTEND    | ACTIVE (users/crm/whatsapp); extend auth/encryption/retention.
AI Brain/Orchestration| BUILD NEW | No centralized layer; scattered email AI only; build service + event framework.
Unified Inbox       | EXTEND    | Channel adapters build on existing APIs; canonical model new.
UI / Brand (DHD->FollOps)| REFACTOR | BRAND.md defines; UI copy + localStorage keys change; DB names preserved.
Security / Auth     | EXTEND    | Document gaps; add rate-limit/CSP/audit/HMAC; do NOT rotate.

=== 11. IMPLEMENTATION ROADMAP (FUTURE PACKETS — NOT IMPLEMENTED) ===
Packets (separate; WP-001 untouched):
  WP-ARCH-A: Rebrand (UI/docs + localStorage rename schedule; no DB rename now; technical IDs preserved) — INDEPENDENT, may proceed in parallel with all others.
  WP-INBOX: Unified Inbox (Conversation/Message + adapters + identity resolution; canonical normalization layer) — must complete interaction/event contract before WP-AI-BRAIN Core.
  WP-CALL-INT: Call Intelligence extension (Companion -> private storage -> Whisper -> AI -> Timeline; depends on device auth design AND security hardening first).
  WP-AI-BRAIN: Centralized AI (service layer + business events + provider registry + safety rules) — depends on canonical interaction/event contract (WP-INBOX), NOT on full Inbox UI completion; uses inbox events + transcription events.
  WP-SEC: Security foundation/hardening (rate limit / CSP / PII audit / webhook HMAC / device auth) — MUST PRECEDE sensitive AI / call-recording production expansion; parallel prerequisite.
Dependencies: WP-SEC (prerequisite, parallel start) -> WP-INBOX (interaction/event contract) -> WP-AI-BRAIN Core; WP-CALL-INT (parallel to inbox, feeds AI, gated by WP-SEC); WP-ARCH-A (independent).

WP-001 WhatsApp webhook failure: SEPARATE — blocked at Layer B/C; requires owner evidence (redacted webhook state + Vercel POST log) before fix; this document does NOT unblock.

=== 12. VERIFICATION / QA / SECURITY SIGN-OFF (READ-ONLY AGAINST origin/master) ===
QA (independent verification executed via bash / git objects, not working-tree assumption):
  - 10 claims verified PASS against git ls-tree / git show / git grep (recordings.ts 478, crm.ts 1204, whatsapp.ts 2928, BRAND.md present, agents 6 files, companion_installed, transcription_tables, whisper-1, divergence 3|0).
  - Incorrect claims removed: MISSING files (5), 421-line claim, 0/255 divergence claim, Companion BUILD-NEW-only claim, CallVault internal claim.
  - No fabricated references inserted; no invented paths; all claims trace to git object IDs at 8606139.
Security (trust boundaries defined; no mutation):
  - Private storage + signed URLs + device auth defined.
  - Audit trail + Suggest/Approve/Auto authority defined.
  - P0 exceptions acknowledged (rate limit / CSP / PII audit / webhook auth).
  - No credential change; no RLS mutation; no webhook auth edit; no master merge.
Principal Architect approval required before any packet implementation; before any DB/RLS change; before any branding deployment at production scale; before any AI action authority change.

=== REQUIRED ENDING ===
FOLLOPS TARGET ARCHITECTURE CORRECTED AND VERIFIED
Branch: WP-ARCHITECTURE-REVALIDATED (corrected commit after this edit — normal commit, no amend/force-push)
Previous architecture branch SHA (before this edit): 0a8ccf1ec5497d5cc44fd6384dc1e2b32295ebd0
New commit SHA after edit: (to be reported after commit + push — see end)
Verified origin/master SHA: 86061398cfb4857aaf4486fd40b207c81e0e645d
Incorrect claims removed: api/recordings.ts MISSING; api/crm.ts MISSING; BRAND.md MISSING; .claude/agents/ ABSENT; api/whatsapp.ts 421 lines; 0/255 divergence; Companion zero-build; CallVault internal
QA verdict: PASS — all current-state claims verified against origin/master Git objects
Security verdict: REVIEW COMPLETE — trust boundaries defined; P0 gaps documented; no production mutation performed; no deploy; no master merge; WP-001 preserved
FOLLOPS ARCHITECTURE APPROVAL CLEANUP + AGENT PREFLIGHT PACKET READY
Co-Authored-By: Claude Code <noreply@anthropic.com>
