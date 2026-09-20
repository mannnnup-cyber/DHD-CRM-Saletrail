# WP-ARCHITECTURE-REVIEW — REVALIDATED AGAINST ORIGIN/MASTER (8606139)
# Status: Planned (read-only verification; no production edits)
# Branch: WP-ARCHITECTURE-REVALIDATED (new, pushed)
# Commit: see push output below
# Zero production edits; zero deploy; zero DB/RLS/credential changes.

VERIFICATION COMMANDS EXECUTED (read-only):
- git fetch origin (repo + worktree WP-001-whatsapp): exit 0
- git rev-parse --short HEAD (repo): 8606139 | branch: master
- git rev-parse --short origin/master: 8606139
- Divergence: 0 ahead / 0 behind (no divergence)
- File checks: git ls-files / git status --short / ls -la
- grep searches (branding, AI, companion, DB) executed; NO code edited

MOST IMPORTANT CORRECTIONS FROM PRIOR STALE VERSION:
1. REMOVED fabricated references: components/nav/Navbar.tsx, pages/_app.tsx, lib/callVault/, api/calls/ — NONE EXIST on 8606139.
2. api/recordings.ts is ACTIVE (478 lines) — Companion upload + transcription + Whisper — NOT Twilio.
3. api/whatsapp.ts is ACTIVE (2928 lines) — webhook receiver ~163-555; syncEvolutionMessages 1853-2059.
4. AI: api/email.ts lines 114-122/openai callOpenAI gpt-4o-mini; api/recordings.ts 416-448/whisper-1.
5. DB tables verified: contacts, interactions, calls, tasks, users, deals, invoices, emails, call_transcripts, transcription_jobs.
6. Branding: .claude/agents/ ACTIVE (FollOps); docs/context/BRAND.md ACTIVE; AGENTS.md PARTIAL; UI has DHD/SaleTrail legacy refs.
7. Companion: ACTIVE (src/components/CompanionConnect.tsx, src/pages/CompanionApp, api/users.ts companion_installed).
8. NO docs/architecture/ or docs/planning/ directories exist (NOT FOUND — documented, not invented).

CLASSIFICATION SUMMARY (verified against 8606139):
- ACTIVE: api/recordings.ts, api/whatsapp.ts, api/email.ts, api/social.ts, api/crm.ts, api/contacts.ts, api/tasks.ts, api/users.ts, .claude/agents/, docs/context/BRAND.md, companion_installed fields, AI pipeline (openai/whisper)
- PARTIAL: AGENTS.md (mixed DHD refs), Call Intelligence (exists but incomplete docs), AI Brain (configured, no full workflow doc), UI branding (DHD/SaleTrail legacy remains)
- LEGACY: DHD auth keys (dhd_auth), localStorage keys (dhd_salestrail_state), SaleTrail webhook docs in src/pages/WooCommerce.tsx
- NOT FOUND: components/nav/Navbar.tsx, pages/_app.tsx, lib/callVault/, api/calls/, docs/architecture/, docs/planning/
- EXPERIMENTAL / PLANNED: none verified on master; no planned feature files present.

MISMATCH LIST (WP references vs master 8606139):
- components/nav/Navbar.tsx: WP referenced / master MISSING
- pages/_app.tsx: WP referenced / master MISSING
- lib/callVault/: WP referenced / master MISSING
- api/calls/: WP referenced / master MISSING
- api/recordings.ts: WP correctly referenced / master EXISTS (478 lines) — prior doc mischaracterized

NO IMPLEMENTATION STARTED. NO PRODUCT CHANGES. NO RLS/DB/CREDENTIAL MUTATIONS.
