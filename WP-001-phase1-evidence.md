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

--- UPDATE 2026-09-23 (PA instruction: production auth + webhook URL verified; continue controlled trace) ---

PRODUCTION EVIDENCE (owner-provided, from authorized FollOps runtime — redacted, never exposed to file):
- Production connectionState: {"success":true,"connected":true,"state":"open","instanceName":"dhd-crm-wa"}
- Production webhookInfo (current code path api/whatsapp.ts:469-507): {"success":true,"configured":true,"url":"https://dhd-crm-saletrail.vercel.app/api/whatsapp","webhookUrl":"https://dhd-crm-saletrail.vercel.app/api/whatsapp","lastMessageAt":"2026-09-05T04:16:10+00:00"}
- Previous 401 probes = shell auth missing production DB key; NOT production failure.
- Auth source confirmed: Supabase app_settings (getSetting) / Vercel env — in-process mechanism available; shell env did NOT authorize.

WEBHOOK CONFIGURATION (PROVEN PARTIAL — Layer B):
- Configured: YES
- URL match: YES — https://dhd-crm-saletrail.vercel.app/api/whatsapp (matches production callback)
- enabled: NOT PROVEN by current webhookInfo (discarded — see below)
- registered events: NOT PROVEN — MESSAGES_UPSERT not confirmed
- webhookByEvents / webhookBase64: NOT PROVEN
- lastMessageAt = 2026-09-05T04:16:10+00:00 — long gap despite open session (evidence of inbound/persistence failure, not root-cause locator)

CODE ANALYSIS — webhookInfo (api/whatsapp.ts:493-502):
- Fetches /webhook/find/{instanceName}; if r.ok parses JSON.
- Extracts ONLY: data?.url || data?.webhook?.url; returns success, configured (!!currentUrl), url, webhookUrl, lastMessageAt.
- DISCARDS: enabled, events, webhookByEvents, webhookBase64, and all other Evolution webhook fields.
- Proposes SMALLEST non-mutating enhancement: extend webhookInfo return to include non-secret fields enabled, events, webhookByEvents, webhookBase64 from Evolution response — read-only, no mutation to Evolution; requires PA authorization before deployment. Recommended: add to api/whatsapp.ts webhookInfo branch (line ~496-502) — no secret exposure (events/enabled are config metadata, not credentials).

LAYER STATUS (per PA-corrected diagnostic order):
- Layer A (session/connectivity): PASS (state=open, connected=true) — NOT proof of fresh inbound receipt
- Layer A (fresh inbound message/event from Evolution): NOT PROVEN — requires provider-side evidence endpoint per installed Evolution version/contract (not invented; docs/ARCHITECTURE.md+INTEGRATIONS.md reference Baileys, port change Sep 2026; no /message/store in repo — must confirm exact endpoint with owner/version)
- Layer B (webhook registered + MESSAGES_UPSERT + enabled): PARTIAL — URL confirmed; events/enabled NOT confirmed
- Layers C-F: BLOCKED upstream

READ-ONLY TRACE ORDER (1-11) — STATUS:
1. Evolution version/build/host: PARTIAL — Baileys referenced; exact version endpoint not yet executed (awaiting owner/authorized-runtime confirmation of endpoint name — not invented)
2. /connectionState/dhd-crm-wa: PASS (proof provided by owner)
3. /webhook/find/dhd-crm-wa: PARTIAL (current webhookInfo discards fields; direct read not executed — auth available but must use authorized runtime)
4. Registered callback URL: PASS (matches production)
5. Enabled state: NOT PROVEN
6. Registered events (MESSAGES_UPSERT): NOT PROVEN
7. Provider-side fresh inbound evidence: NOT EXECUTED — endpoint requires version confirmation
8. Webhook delivery attempt/result: NOT EXECUTED
9. Vercel /api/whatsapp POST: NOT EXECUTED (needs Layer A message)
10. whatsapp_messages persistence: LAST = 2026-09-05; gap evidence only
11. FollOps UI visibility: NOT EXECUTED

PREREQUISITE BEFORE CONTINUING TRACE:
- Confirm exact Evolution read-only endpoint for message/event receipt (owner/version) — NOT /message/store invented.
- Confirm webhook enabled + MESSAGES_UPSERT via either (a) enhanced webhookInfo (PA-approved) or (b) direct /webhook/find in authorized runtime (redacted evidence to branch).
- Execute ONE controlled inbound message: sender -> WhatsApp -> Evolution ingestion -> MESSAGES_UPSERT -> POST /api/whatsapp -> persistence -> UI.

RESTRICTIONS OBSERVED: No webhook mutation (/webhook/set not called). No reconnect. No QR. No rotation. No RLS. No deployment. Evidence/research only.

END FORMAT: WP-001 TRACE BLOCKED — PROVIDER-SIDE LAYER A EVIDENCE + WEBHOOK EVENTS/ENABLED REQUIRED (not invented; needs owner confirmation of endpoint + PA-approved diagnostic enhancement or direct read)
