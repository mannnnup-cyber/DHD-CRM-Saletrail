# WP-001 Phase 1 Evidence — 2026-09-23 (branch WP-001-whatsapp-fresh @ d76e0db)

## Source / Scope
- Branch: WP-001-whatsapp-fresh from origin/master d76e0db (NOT old 981d03a).
- Packet: docs/work-packets/active/WP-001-whatsapp-webhook-failure.md (status: Review / BLOCKED).
- Previous branch WP-001-whatsapp (a2adb32, 295 commits) preserved; diagnostic findings copied from docs/diagnosis-findings.md.

## Phase 1 — Deployment / Provider Truth (read-only, no mutation)
- Evolution API endpoint: http://76.13.31.176:8080 (ARCHITECTURE.md, INTEGRATIONS.md; port changed from :32768 Sep 2026).
- Active instance: dhd-crm-wa (Baileys, phone 18765202038 per INTEGRATIONS.md).
- Provider registered: evolution (DEPLOYMENT_SUMMARY.md line 153; api/whatsapp.ts:130-161 getSetting).
- API key retrieval: process.env.EVOLUTION_API_KEY || await getSetting('EVOLUTION_API_KEY', '') (api/whatsapp.ts:161). Key resolves from Supabase app_settings; NOT committed to branch; redacted from this report (per security directive).

## Live Probe Results (redacted key used — 401 returned for /instance/connectionState and /webhook/find; 401 expected if placeholder used instead of real DB key)
- GET /instance/connectionState/dhd-crm-wa → HTTP 401 (unauthenticated; needs valid apikey header).
- GET /webhook/find/dhd-crm-wa → HTTP 401.
- Probe purpose: confirm actual webhook registration, events (MESSAGES_UPSERT), callback URL, enabled state. Not completed because real key must be provided by OWNER / pulled from DB at probe time; it is NOT exposed in repo or in this branch.

## Security / Pre-existing (NOT new — documented P0, do not expand unless required for fix)
- api/whatsapp.ts public webhook receiver; NO signature/auth validation (SECURITY.md; packet Scope; diagnosis-findings.md).
- Security review mandatory for webhook path; must NOT autonomously rotate credentials or change RLS.

## Status
WP-001 BLOCKED AT LAYER B/C — OWNER EVIDENCE REQUIRED.
- Cannot confirm Layer A (Evolution actually received fresh inbound) without a successful connectionState read with the real key.
- Cannot confirm Layer B (webhook registered / MESSAGES_UPSERT included / callback URL correct) without a successful webhook/find read.
- Cannot execute Phase 2 controlled inbound trace (A-F) while Layer A+B evidence missing — per directive: "Layer A is proven healthy only if the active Evolution instance/provider itself shows the fresh inbound message/event." Customer WhatsApp delivery to number does NOT prove Evolution received it.

## Restrictions observed
- No instance delete/recreate. No QR rescan. No credential rotation. No RLS change. No speculative production deploy. No source mutation on master.
- Only diagnostic branch (WP-001-whatsapp-fresh) modified; new evidence file added; no merge.
