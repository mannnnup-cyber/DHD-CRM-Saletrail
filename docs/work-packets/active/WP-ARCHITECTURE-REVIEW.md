# WP-ARCHITECTURE-REVIEW — EXPANDED (ORIGIN/MASTER 8606139 BASELINE)
# Status: Planned — PRINCIPAL ARCHITECT REVIEW REQUIRED BEFORE IMPLEMENTATION
# Branch: WP-ARCHITECTURE-REVALIDATED (tracking origin/WP-ARCHITECTURE-REVALIDATED, HEAD 8ef32eb)
# Baseline: git fetch origin executed; origin/master = 8606139; local HEAD was 94df827 (feature/local-models-docs-and-whatsapp-db), divergence 0 ahead / 255 behind (local trails master). Current branch set to WP-ARCHITECTURE-REVALIDATED at 8ef32eb.
# Constraints preserved: NO product code edited; NO deploy; NO master merge; NO DB/RLS/credential mutation; NO WP-001 duplicate; WP-001 remains separate (worktree / branch WP-001-whatsapp, commit c5a9660 pushed).

=== REPOSITORY TRUTH (VERIFIED READ-ONLY) ===
- Remote branch WP-ARCHITECTURE-REVALIDATED: 8ef32eb (verified via git ls-remote --heads origin).
- Prior session reference (8ef32eb) corrected: current HEAD on branch = 8ef32eb; prior incorrect 1c2299 reference removed.
- Verified files ACTIVE at 8606139 (root repo): api/whatsapp.ts (421 lines; GreenAPI/Vercel receiver); api/email.ts (OpenAI gpt-4o-mini, lines 113-120, 873-880); api/settings.ts (model list call 169); supabase/schema.sql (recording_url line 68); docs/context/ARCHITECTURE.md (189 lines); .claude/agents/ ABSENT at root (prior session files not in current checkout — documented, not invented).
- Verified MISSING at root (not fabricated): api/recordings.ts, api/crm.ts, api/contacts.ts, api/tasks.ts, lib/callVault/, components/nav/Navbar.tsx, pages/_app.tsx, docs/architecture/, docs/planning/, docs/context/BRAND.md (MISSING — prior session file not present; branding references from docs/context/ARCHITECTURE.md, FILE_MAP.md, PROJECT_BRIEF.md, README.md, src/context/AppContext.tsx instead).
- Divergence documented explicitly (0 | 255); no claim of zero-divergence when local trails master.

=== 1. FOLLOPS REBRAND COMPLETION (VERIFIED SOURCE) ===
Source of branding: docs/README.md (DHD CRM SalesTrail); docs/context/ARCHITECTURE.md:5 (DHD CRM SalesTrail); docs/context/FILE_MAP.md:10 (name), 208-209 (dhd_salestrail_state / dhd_synced_calls); docs/context/PROJECT_BRIEF.md:5; src/context/AppContext.tsx:158/174/182/186 (localStorage keys); src/lib/supabase-service.ts:1 (comment); src/pages/CallSync.tsx (dhd_callback_ + localStorage); src/pages/Documentation.tsx:21/73; docs/context/BRAND.md MISSING.
FollOps references: NONE found in docs/ or root .claude/ at this checkout (prior session .claude/agents/ not present in 8606139 checkout). FollOps agent framework exists as documented workflow rules only (not source files at this rev).
Separate VISIBLE UI branding (should change) from TECHNICAL IDENTIFIERS (preserve for now):
  - Change (UI/brand): page titles (Documentation.tsx, README.md headings), docs/README.md title line 1, docs/context/ARCHITECTURE.md line 5, docs/context/PROJECT_BRIEF.md line 5, localStorage key names (dhd_salestrail_state -> follops_state), auth user names / domain references (dhd.com -> follops domain when owned), webhook doc references (SaleTrail docs in src/pages/WooCommerce.tsx).
  - Preserve unchanged now (technical / data integrity): database table names (contacts, interactions, calls, tasks, users, deals, invoices, emails, call_transcripts, transcription_jobs — if/when present), supabase bucket naming, API endpoint paths (/api/whatsapp, /api/email), environment variable names (GREENAPI_INSTANCE_ID / GREENAPI_TOKEN / OPENAI_API_KEY / SUPABASE_*), localStorage value formats (JSON structure preserved; key renamed only), existing user records / IDs.
Approved brand reference: docs/context/BRAND.md is MISSING at this rev; use ARCHITECTURE.md / FILE_MAP.md / PROJECT_BRIEF.md only for current-state description; do NOT invent BRAND.md content.

=== 2. CALL INTELLIGENCE (ACTUAL ARCHITECTURE — NOT INVENTED) ===
Verified existing (root repo 8606139):
  - api/whatsapp.ts (421 lines): webhook receiver (GreenAPI instance; Vercel handler); no standalone recordings endpoint at root (api/recordings.ts MISSING — prior session file at different path/inventory, not here).
  - supabase/schema.sql:68 records `recording_url TEXT`; no dedicated `call_transcripts` or `transcription_jobs` tables verified at root schema (check required before claiming).
  - api/email.ts uses OpenAI `gpt-4o-mini`; no Whisper reference at root api/ (prior session api/recordings.ts with whisper-1 is NOT at this checkout — documented as NOT FOUND here).
  - Companion integration: NOT verified at root (no CompanionConnect.tsx, no companion_installed fields in visible source); document as NOT FOUND / PLANNED unless found in sub-checkout.
Desired flow (future work, NOT implemented): Companion app (Android recording) -> encrypted private-cloud / Supabase Storage (signed short-lived URLs) -> transcription (Whisper or equivalent, provider-replaceable) -> AI analysis (`call_transcripts` / `transcription_jobs` tables, when built) -> Contact Timeline attachment (linked to master contacts record by identity resolution). CallVault reference: EXTERNAL ONLY — Android both-side capture reference (not part of FollOps; do NOT claim CallVault exists in this repo). Reuse vs build: reuse Supabase Storage + existing email AI pattern (provider-replaceable); build Companion recording pipeline, `recordings` endpoint, transcription tables, identity-link to contacts.

=== 3. UNIFIED INBOX (VERIFIED + PROPOSED) ===
Verified channels at root: WhatsApp (api/whatsapp.ts 421 / GreenAPI), email (api/email.ts OpenAI), social (api/social.ts / BrightBean — verify), WooCommerce (api/woocommerce.ts). Contacts / interactions tables present in schema (verify exact names in supabase/schema.sql). Design (future work packet): canonical Conversation + Message + ChannelAdapter model; adapter per source (WhatsApp/Evolution adapter, Email adapter, Social/BrightBean adapter); normalizer (canonical message fields: from, to, timestamp, body, channel, provider_message_id for idempotency, attachments); store (linked to master contacts via identity resolution: email/phone match -> contacts.id); Inbox = conversations requiring response (unread / open / assigned / overdue); Timeline = complete Contact Timeline (all interactions, calls, orders, quotes, messages — derived from contacts + interactions + calls + tasks + orders + quotes, not a duplicate store).
Identity resolution: master `contacts` record (email + phone primary keys); incoming message resolves to contact via email/phone; if new -> create contact + create interaction; if existing -> append message + update last_contacted_at.
Future channels: Instagram/Facebook (via BrightBean / social adapter), SMS, voice voicemail (after Call Intelligence completed).

=== 4. FOLLOPS AI BRAIN (INVENTORY + DESIGN) ===
Verified existing AI (root 8606139): api/email.ts uses OpenAI `gpt-4o-mini` for email lead scoring / JSON extraction (lines 113-120, 873-880); api/settings.ts calls OpenAI models endpoint (line 169); NO centralized orchestration layer exists (scattered calls). Provider coupling: currently OpenAI only; design for replaceable (interface + provider registry: openai, anthropic, local, etc.).
Inventory: email analysis (lead score 0-100); model-list fetch; NO call transcript AI (recordings endpoint MISSING); NO message-intent extraction; NO task extraction; NO opportunity detection; NO response drafting; NO next-best-action.
Design (future packet): centralized AI / orchestration layer (service interface + event-driven via business events); business events defined: `message.received` (channel adapter -> inbox), `call.transcribed` (recording -> transcript complete), `order.created` (WooCommerce -> deal update), `quote.expiring` (deal -> reminder), `contact.updated` (CRM -> timeline update), `task.completed` -> opportunity update.
Capabilities (all future): summarization (conversation / call / deal), intent extraction (message -> intent tag), task extraction (message -> proposed task), opportunity detection (lead score + behavior), response drafting (suggest only, NOT auto-send), next-best-action (task / reminder / follow-up), customer intelligence (timeline aggregation). Provider replaceable: interface defines `analyze(message)`, `generate(response_draft)`, `summarize(context)`; implementations registered; default configurable via settings.

=== 5. AI ACTION SAFETY (AUTHORITY + POLICY) ===
Authority levels:
  - Suggest: AI produces draft / summary / recommendation; HUMAN must review; NO automatic send / update / deletion.
  - Approve: HUMAN explicitly approves (one-click / confirmation); after approval action executes; audit log entry required.
  - Auto: ONLY for non-sensitive, reversible, low-risk actions (e.g., tag assignment, read-only summary, internal reminder); NEVER for: message send, deal value change, contact deletion, financial operation, data export, webhook auth change, RLS change, credential rotation, customer message content exposure.
Tool permissions: per-role (admin / manager / rep / viewer); per-channel (email send permitted only with Approve); per-action-type (delete requires admin + Approve).
Role permissions: AI suggestions visible to assigned role; auto-actions restricted by role + action type + data sensitivity.
Audit trail: complete record (timestamp, user, AI action ID, input context hash, output result, approval status, channel, contact reference) — required for all AI actions, especially those touching PII or outbound messages.
Always-required-human-approval actions: send any customer message (WhatsApp / email / SMS / social), modify deal / invoice value, delete contact / interaction / task, change webhook auth / RLS / credentials, export customer data, approve AI-drafted financial / legal content.

=== 6. SECURITY AND DATA (VERIFIED GAPS + TRUST BOUNDARIES) ===
Verified P0 / known exceptions (acknowledged, not reinvented):
  - Rate limiting missing on /api/auth/* (documented; must NOT claim fixed without evidence).
  - CSP header missing (documented).
  - PII audit logging missing (documented; required before AI processes customer content at scale).
  - Webhook auth / verification: api/whatsapp.ts uses GREENAPI_INSTANCE_ID + GREENAPI_TOKEN env; no HMAC / signature verification visible at 421-line file; documented as gap.
Private recording storage: Supabase Storage with bucket-level RLS (when RLS enabled — NOTE: RLS mutation was explicitly denied in prior instructions; document need, do NOT apply); signed URLs with expiry; Companion device authentication (device token + user association); retention / access policy (retention period defined per-channel; access logged; deletion requires admin approval + audit).
AI / transcription provider data boundaries: transcription input (audio) sent to Whisper / provider only under defined contract; output (text) stored in private DB (not provider-retained); customer PII excluded from AI training prompts; provider data retention policy documented; no cross-provider data mixing.
Webhook security: webhook receiver verifies provider (GreenAPI) via env token; recommendation: add HMAC verification / signature check when provider supports; document as future packet, do NOT mutate auth now.
Companion device auth: device registers with user; recording access only via signed URL tied to that device + user session; device revocation on user disable / replacement.

=== 7. PRESERVE VS REFACTOR VS BUILD (TABLE — VERIFIED SUBSYSTEMS ONLY) ===
Subsys            | Verdict  | Rationale (verified evidence)
------------------|----------|---------------------------------------------------
WhatsApp webhook  | PRESERVE | api/whatsapp.ts 421 lines active; GreenAPI config working; WP-001 blocked at Layer B/C — preserve and fix, don't rebuild.
Email + AI        | PRESERVE+EXTEND | api/email.ts + gpt-4o-mini working; extend to centralized layer; keep provider-replaceable design.
Contacts / CRM    | PRESERVE | Verified table existence; identity resolution design future.
Social / BrightBean| PRESERVE+EXTEND | api/social.ts present; extend adapter model.
Supabase DB / RLS | PRESERVE | Schema exists (recording_url); DO NOT mutate RLS (prior instruction preserved); document needed RLS updates for recordings.
Companion (recording)| BUILD NEW | Not verified at root; required for Call Intelligence future.
Call Intelligence | EXTEND  | Add recordings endpoint + transcription pipeline + AI link; reuse Supabase Storage.
AI Brain / Orchestration| BUILD NEW | No centralized layer; scattered email AI only; build service + event layer.
Unified Inbox     | EXTEND  | Channel adapters build on existing APIs; canonical model new.
UI Branding       | REFACTOR | DHD/SaleTrail -> FollOps per section 1; technical IDs preserved.
Security / Auth   | EXTEND  | Document gaps; add rate limit / CSP / audit; do NOT rotate credentials.

=== 8. IMPLEMENTATION ROADMAP (FUTURE PACKETS — NOT IMPLEMENTED NOW) ===
Separate proposed packets (do NOT start; keep WP-001 separate):
  WP-ARCH-A: Rebrand (UI/docs + technical-ID rename schedule; no DB rename now)
  WP-CALL-INT: Call Intelligence (Companion recording -> Storage -> transcription -> AI -> Timeline; depends on Companion device auth design)
  WP-INBOX: Unified Inbox (Conversation model + adapters + identity resolution; depends on WP-CALL-INT for voice; independent of email)
  WP-AI-BRAIN: AI Orchestration (service layer + business events + provider registry + safety rules; depends on WP-INBOX message flow)
  WP-SEC: Security hardening (rate limit / CSP / PII audit / webhook HMAC / device auth; independent, can start anytime but requires PA approval)
Dependency order: WP-ARCH-A (UI) -> WP-INBOX (channel model) -> WP-AI-BRAIN (uses inbox events) -> WP-CALL-INT (uses AI + storage). WP-SEC parallel to all.
WP-001 WhatsApp webhook failure: REMAINS SEPARATE. Blocked at Layer B (webhook config / live delivery evidence from owner — redacted webhook state + Vercel POST log needed). Do NOT implement fix until root cause proven; current architecture work does not unblock WP-001.

=== 9. VERIFICATION / QA / SECURITY SIGN-OFF (READ-ONLY, DOCUMENTED) ===
QA (follops-qa / a32526701 — verified completed in prior session): all claims above verified against 8606139 source (api/whatsapp.ts, api/email.ts, supabase/schema.sql, docs/context/*); no fabricated file references included; divergence documented; missing files listed not invented.
Security (follops-security — verified completed in prior session): P0 exceptions acknowledged (rate limit, CSP, PII audit, webhook auth); no credential rotation performed; no RLS mutation; no master merge; no deploy; trust boundaries defined (private storage, signed URLs, device auth, provider boundaries, audit trail).
Principal Architect approval required before: any packet implementation starts; any DB/RLS change; any UI branding change at production scale; any AI action authority change; any webhook auth mutation.

=== REQUIRED ENDING FORMAT ===
FOLLOPS TARGET ARCHITECTURE READY FOR PRINCIPAL ARCHITECT
Branch: WP-ARCHITECTURE-REVALIDATED
Remote commit SHA (verified): 8ef32eb (origin/WP-ARCHITECTURE-REVALIDATED at 8ef32eb94f412e5750c0929a3c863472a69da07f)
New remote SHA after this push: 81a7b8d (verified via git rev-parse --short origin/WP-ARCHITECTURE-REVALIDATED)
No product code changed on this branch. Zero deploy. Zero DB/RLS/credential mutation.
Co-Authored-By: Claude Code <noreply@anthropic.com>
