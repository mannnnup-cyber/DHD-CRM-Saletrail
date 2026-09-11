# Integrations — FollOps

## Supabase

| Aspect | Detail |
|--------|--------|
| Purpose | Database, tables, realtime subscriptions |
| Status | Active — RLS lockdown applied (38/38 tables) |
| Credential | `SUPABASE_SECRET_KEY` preferred → `SUPABASE_SERVICE_ROLE_KEY` fallback → anon |
| Security | P0: legacy `service_role` key still enabled by owner deferral |
| Notes | All public tables under RLS; 29 permissive policies dropped; anonymous reads blocked |

## Vercel

| Aspect | Detail |
|--------|--------|
| Purpose | Deployment, serverless API runtime, daily cron |
| Status | Active |
| Notes | `vercel.json` defines daily 9am cron for automation engine; maxDuration per function |

## Evolution API / WhatsApp

| Aspect | Detail |
|--------|--------|
| Purpose | WhatsApp send/receive (secondary provider) |
| Status | Active (Docker at `http://76.13.31.176:8080`) |
| Instance | `dhd-crm-wa`, phone 18765202038 |
| Notes | Baileys — outbound calls NOT supported (inbound CALL events only); port changed from :32768 in Sep 2026; webhook signature checks absent |

## Green API / WhatsApp

| Aspect | Detail |
|--------|--------|
| Purpose | WhatsApp send/receive (primary provider) |
| Status | Active |
| Notes | Uses `GREENAPI_INSTANCE_ID` + `GREENAPI_TOKEN`; controlled by `WHATSAPP_ACTIVE_PROVIDER` app_setting |

## WooCommerce

| Aspect | Detail |
|--------|--------|
| Purpose | Order/customer sync |
| Status | **Broken — REST 403** (store rejects stored consumer key) |
| Credentials | `WC_STORE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` |
| Notes | Webhook receiver (`api/woocommerce-webhook.ts`) exists but no active webhook; `WC_WEBHOOK_SECRET` pending |

## BrightBean Studio

| Aspect | Detail |
|--------|--------|
| Purpose | Social media scheduling/publishing (free hosted plan) |
| Status | **Partial — `/accounts/` HTTP 500** (upstream regression since 2026-09-07) |
| Credentials | `BRIGHTBEAN_API_KEY` in `app_settings` (password type, masked) with `BRIGHTBEAN_API_KEY` env fallback; DB wins over env |
| Notes | `/me/` works; YouTube token expired (needs owner reconnect); `/accounts/` 500 classified as external |

## IMAP / Email

| Aspect | Detail |
|--------|--------|
| Purpose | Email inbox sync, compose, send |
| Status | Active |
| Credentials | `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS` (env-first, `app_settings` fallback) |
| Notes | IMAP library behavior; email credentials are security-sensitive |

## Resend

| Aspect | Detail |
|--------|--------|
| Purpose | Outbound email |
| Status | **Broken** — outbound email failing (suspected domain verification; unconfirmed) |
| Credentials | `RESEND_API_KEY` (env-first, `app_settings` fallback) |

## Android Companion

| Aspect | Detail |
|--------|--------|
| Purpose | GSM call sync from rep devices |
| Status | Active |
| Notes | Syncs via `POST /api/whatsapp?action=addGSMCall`; device info (android_version, device_brand) stored in `devices` table; `rep_phone`/`devices.phone_number` format must match (10-digit, no country code) |

## AI Providers

| Aspect | Detail |
|--------|--------|
| Purpose | AI enrichment, email analysis, reply drafting |
| Status | Active |
| Providers | OpenAI + Anthropic Claude |
| Notes | Both APIs validated in Settings; multi-provider key management |

## Other Confirmed Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| GitNexus | Codebase indexing for AI-assisted development | Active |
| Context7 | Up-to-date framework/library docs | Active |

## Security-Sensitive Integrations

- **WooCommerce** — REST credentials, webhook endpoint
- **BrightBean** — API key (password type, masked)
- **IMAP/Email** — email credentials
- **Resend** — email API key
- **Evolution API** — WhatsApp auth key
- **Green API** — WhatsApp auth tokens
- **WhatsApp webhooks** — no signature check (fail-open for WooCommerce; absent for WhatsApp)

## Known Pre-existing Issues

| Issue | Status | Classification |
|-------|--------|----------------|
| WooCommerce REST 403 | Pending | Broken — store rejects stored consumer key |
| Resend outbound failing | Pending | Broken — suspected domain verification |
| Automation cron not running | Pending | Broken — CRON_SECRET unset + header mismatch |
| BrightBean `/accounts/` HTTP 500 | Pending | External upstream regression (unconfirmed) |
| BrightBean YouTube OAuth | Pending | Token expired, needs reconnect |
| Evolution API webhook signature | Pending | No signature check |
