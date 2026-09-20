# WP-ARCHITECTURE-REVIEW — REVALIDATED AGAINST ORIGIN/MASTER
# Status: Planned (requires PA approval — NOT DONE)
# Branch: WP-ARCHITECTURE-REVALIDATED (new dedicated branch, pushed to origin)
# Commit: (see below)
# Zero production edits; zero deploy; zero DB/RLS/credential changes; master preserved.

Local HEAD: 8606139 (master)
origin/master: 8606139
Drift found: NONE (0 ahead, 0 behind)
Source of incorrect files in prior WP-ARCHITECTURE-REVIEW.md: Fabricated / stale references (files listed as present — Navbar.tsx, pages/_app.tsx, lib/callVault/, api/calls/ — do NOT exist on master; previous document used non-existent paths from stale/generator output, not current repo state)
Remote review branch: WP-ARCHITECTURE-REVALIDATED

--- CORRECTIONS TO PRIOR DOCUMENT (major) ---
1. Removed fabricated file references (Navbar.tsx, pages/_app.tsx, lib/callVault/, api/calls/, api/recordings.ts mischaracterized as "Twilio" rather than Composer Companion)
2. Classified api/recordings.ts as ACTIVE (real Companion upload + transcription queue; lines 157 reference useCallRecorder.ts companion app; not Twilio)
3. Classified api/whatsapp.ts as ACTIVE (2928 lines; webhook receiver lines 164-555; syncEvolutionMessages 1853-2059; verified against actual source)
4. Added REAL AI code references (api/crm.ts lines 719-734: transcription + sentiment + keyword extraction; api/email.ts lines 114-122: OpenAI key integration)
5. Added REAL contact/interactions DB tables (api/contacts.ts, api/crm.ts, api/email.ts, api/tasks.ts, api/users.ts)
6. Classified lookup results explicitly: ACTIVE / PARTIAL / LEGACY / EXPERIMENTAL / PLANNED / NOT FOUND
7. Removed references to missing docs/architecture/ and docs/planning/ (NOT FOUND — gap documented, not invented)
8. Confirmed FollOps branding in .claude/agents/ and docs/context/BRAND.md; AGENTS.md PARTIAL (mixed DHD-CRM references remaining)
9. CallVault / Call Intelligence: EXISTING (api/recordings.ts + api/crm.ts transcription pipeline) — not missing; prior doc overstated gaps
10. Companion installed flag verified (api/users.ts, api/crm.ts)

--- REAL EXISTING COMPONENTS (verified on origin/master 8606139) ---
- api/recordings.ts (478 lines, ACTIVE) — Companion recording upload + transcript retrieval
- api/whatsapp.ts (2928 lines, ACTIVE) — Evolution webhook + sync
- api/email.ts (ACTIVE) — OpenAI key integration, email sending
- api/social.ts (ACTIVE) — social integration
- api/crm.ts (ACTIVE) — call_transcripts table, sentiment analysis, topic extraction
- api/contacts.ts / api/tasks.ts / api/users.ts (ACTIVE) — contacts/interactions/permissions
- .claude/agents/*.md (ACTIVE) — FollOps framework
- docs/context/BRAND.md (ACTIVE) — FollOps brand
- AGENTS.md (PARTIAL) — FollOps + legacy DHD refs
- api/recordings.ts line 4, 157 — Companion app reference (useCallRecorder.ts)
- NO components/nav/Navbar.tsx, NO lib/callVault/, NO api/calls/, NO pages/_app.tsx (NOT FOUND)

--- CLASSIFICATION SUMMARY ---
ACTIVE: api/recordings.ts, api/whatsapp.ts, api/email.ts, api/social.ts, api/crm.ts, .claude/agents/, docs/context/BRAND.md, companion_installed fields
PARTIAL: AGENTS.md (branding incomplete), Call Intelligence (transcription exists but no real-time pipeline documented), AI Brain (OpenAI configured but no full workflow)
LEGACY/WRONG SOURCE: Prior WP-ARCHITECTURE-REVIEW.md file references
NOT FOUND: docs/architecture/, docs/planning/, components/nav/Navbar.tsx, lib/callVault/, api/calls/, pages/_app.tsx

CORRECTED REVIEW READY FOR PA REVIEW — NO PRODUCT IMPLEMENTATION STARTED.
