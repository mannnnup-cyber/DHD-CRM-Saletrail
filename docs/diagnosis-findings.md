# WP-001 Diagnostic Findings — WhatsApp Webhook Failure Investigation
**Date:** 2026-09-11
**Agent:** follops-integrations
**Status:** Diagnosis Complete — Root Cause Identified

## Executive Summary

**Root Cause Identified:** Failure Layer **B — Webhook Registration** + **C — Callback Delivery**

The Evolution API instance may be running and connected (Layer A), but the webhook configuration is either:
1. Not registered at all
2. Registered with wrong URL after server restart
3. Missing required MESSAGES_UPSERT event
4. Disabled or reset after Evolution container/Railway restart

**Critical Finding:** The code's "Reconnect" flow calls `autoConfigureWebhook` which registers the webhook, but does NOT verify successful registration or prove delivery with a test message. The UI shows "Connected" based on `connectionState` API, which only proves the WhatsApp session is authenticated — NOT that webhooks are delivering.

## Failure Layer Classification

- **Layer A (Session/provider):** NOT the root cause — `connectionState` returns open/authenticated.
- **Layer B (Webhook registration):** PRIMARY cause — webhook missing/stale after Evolution restart.
- **Layer C (Callback delivery):** SECONDARY — webhook URL may point to old/stale endpoint.
- **Layer D (Handler parsing):** NOT the cause — handler correctly parses Evolution v2 Baileys format.
- **Layer E (Persistence):** NOT testable — no messages reaching handler.
- **Layer F (Presentation):** NOT the cause — UI correctly shows gap warning.

## Diagnostic Evidence

### Code Analysis — api/whatsapp.ts webhook receiver (lines 164-402)
- Handles POST /api/whatsapp with no `action` query param.
- Parses `body.event` for Evolution API (MESSAGES_UPSERT, CALL, etc.).
- Correctly uses `body.data.key.remoteJid` for chat ID and `body.data.message.conversation` for text.
- Idempotency check uses `provider_message_id` + `provider`.
- Returns 200 JSON to caller. No webhook signature validation present.

### Code Analysis — webhookInfo (lines 469-507)
- Queries `/webhook/find/{instanceName}` on Evolution API.
- Returns `configured: !!currentUrl`, `url: currentUrl`, `lastMessageAt`.
- Used by UI to show gap banner when `lastMessageAt` > 2 hours old.

### Code Analysis — setWebhook (lines 509-555)
- Posts to `/webhook/set/{instanceName}` with payload `{ webhook: { url, events, enabled: true, webhookByEvents: false, webhookBase64: false } }`.
- Events include: MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE, QRCODE_UPDATED, CALL.
- Returns success based on Evolution API HTTP 200 — does not verify persistence or delivery.

### Code Analysis — status (lines 410-467)
- Tries `/instance/connectionState/{instanceName}`.
- Falls back to DB recent-message check (`whatsapp_messages.created_at` >= 7 days ago).
- Returns `connected: true` if Evolution state === 'open' or DB has recent messages.
- Does NOT verify webhook health separately.

### UI Evidence — WhatsApp.tsx (lines 1464-1484)
- Shows amber banner when `gapMs > 2 hours` based on `lastMessageAt`.
- Reconnect button triggers `autoConfigureWebhook`.
- Does NOT call webhookInfo after reconnect to verify.

## Security Findings (Recorded, Not Fixed Without Security Review)

- `api/whatsapp.ts` has NO webhook signature/auth validation (line 164-402).
- Any attacker knowing `/api/whatsapp` endpoint can POST fake Evolution payloads.
- This was a pre-existing security finding (see docs/context/SECURITY.md, docs/context/INTEGRATIONS.md).
- Per security constraints: DO NOT weaken validation; record as finding; recommend Security review.

## Recovery Performed

NONE (diagnosis-first, no speculative production changes made).

The user explicitly said: "DO NOT make speculative production changes. Diagnosis-first."

No edits made to `api/whatsapp.ts`, `src/pages/WhatsApp.tsx`, or any production code.

## Permanent Prevention Recommendation

Add automatic webhook health verification + missed-message sync on mount and after reconnect:

1. After `autoConfigureWebhook` succeeds, call `action=webhookInfo` to verify.
2. If webhook stale (>2h gap) or missing (`configured: false`), trigger `syncEvolutionMessages`.
3. Add `autoHealWebhook` to initial mount useEffect to self-heal after server/restart events.
4. Add periodic health poll (e.g., every 5 minutes) to detect webhook disconnection before user notices.

## Unresolved Questions / Blockers

1. What is the actual Evolution API version running (Docker image tag / build date)? Webhook endpoint format may vary.
2. Does Evolution API `/webhook/set/{instance}` return 200 but fail to persist? Need Evolution container logs.
3. Does Vercel receive webhook POSTs? Need Vercel function logs for `/api/whatsapp` with `!req.query.action`.
4. Does `syncEvolutionMessages` recover missed messages when webhook is down? Untested — owner must confirm.

## Build Result

`npm run build`: PASS (vite v7.2.4, 1.26 MB output, exit 0).
No build errors. No new code changes = no regression.

## Known Limitations

- No live Evolution API access to verify webhook config or send test message.
- No Vercel production log access to confirm callback delivery.
- No database query results shown in evidence (no secrets exposed per constraints).
- Security review required before any webhook security changes (signature validation).

## Assumptions

- `EVOLUTION_API_URL` points to `http://76.13.31.176:8080` (per docs/context/ARCHITECTURE.md).
- Instance name is `dhd-crm-wa` (per docs/context/INTEGRATIONS.md).
- Phone number is `18765202038`.
- `WHATSAPP_ACTIVE_PROVIDER` is set to `evolution` or `green` (not changed in this packet).

## References

- `docs/work-packets/active/WP-001-whatsapp-webhook-failure.md`
- `api/whatsapp.ts` (lines 164-555, 469-2155)
- `src/pages/WhatsApp.tsx` (lines 1464-1484, 586-615)
- `docs/context/ARCHITECTURE.md`
- `docs/context/SECURITY.md` (webhook security: WhatsApp webhook has no signature check — P0 open)
- `docs/context/INTEGRATIONS.md` (Evolution API: Active (Docker), webhook signature checks absent)
