# WP-SEC-AUTH â€” Security Verification Evidence (verified from origin/master 3e12881)
## Classification per surface
- Evolution/WhatsApp webhook (api/whatsapp.ts): VERIFIED STRUCTURE / GAP (signature enforcement needs verification; provider mechanism documented â€” NOT assumed)
- WooCommerce webhook (src/pages/WooCommerce.tsx): GAP
- BrightBean/social (api/social): NOT APPLICABLE / UNVERIFIED
- Email ingress (api/email.ts): UNVERIFIED â€” document provider mechanism
- JWT/role (api/users.ts): VERIFIED (401/403/200)
- Privileged Supabase (SECRET_KEY vs legacy SERVICE_ROLE): VERIFIED / GAP â€” legacy fallback preserved by owner decision (not disabled)
## Prohibited actions (not performed): credential rotation, RLS mutation, service-role disable, Git-history rewrite, WP-001 fix
## Safe code-only hardening (documented for PA approval): webhook auth verification code, JWT checks, audit references â€” NOT executed beyond evidence recording

=== WOO WEBHOOK (api/woocommerce-webhook.ts) — REAL EVIDENCE FROM MASTER ===
File/function/route: api/woocommerce-webhook.ts / default handler / Vercel serverless POST
Ingress mechanism: x-wc-webhook-topic header + JSON body via POST webhook
Auth mechanism: HMAC sha256 signature (createHmac) against WC_WEBHOOK_SECRET; FAIL-OPEN when secret not set (line 13: return true)
Replay protection: none (no nonce / replay cache observed)
Authorization/role: none (any POST with valid topic processed; no JWT/role check)
Privileged DB client: creates Supabase with SECRET_KEY or SERVICE_ROLE_KEY or ANON_KEY (line 7 — legacy fallback preserved)
Evidence: lines 10-18 (signature verify with fail-open); line 7 (key precedence including legacy); lines 87-105 (DB upsert without RLS check)
Classification: GAP (fail-open when secret missing; no replay protection; privileged DB fallback)
Minimum remediation (design only — not executed): enforce fail-closed; add replay nonce; restrict DB to SECRET_KEY only (with owner authorization for legacy removal)
=== EVOLUTION/WHATSAPP (api/whatsapp.ts) ===
Verified structure: webhook receiver ~line 163; syncEvolutionMessages 1853-2059; external Evolution API
Auth mechanism: provider-specific (GreenAPI token / webhook verification) — DOCUMENTED but full signature verification not fully verified in this packet
Classification: VERIFIED STRUCTURE / GAP
=== BRIGHTBEAN / SOCIAL (api/social.ts) ===
File: api/social.ts active (1 occurrence)
Auth mechanism: NOT FULLY VERIFIED in source — external integration; no explicit webhook handler observed at same depth
Classification: NOT APPLICABLE / UNVERIFIED
=== EMAIL INGRESS (api/email.ts) ===
File: api/email.ts; AI pipeline (openai/gpt-4o-mini lines 114-122); no webhook auth handler in file
Classification: UNVERIFIED — ingress mechanism requires inspection beyond AI pipeline
=== JWT / ROLE (api/users.ts) ===
File/function: api/users.ts; verified containment at cc39569 (unauth 401; manager allow 200; rep denial 403)
Classification: VERIFIED SECURE
=== PRIVILEGED SUPABASE SERVER CLIENT ===
Evidence: .claude/agents/follops-lead.md step 9 (git show); docs/context/SECURITY.md (38/38 RLS; SECRET_KEY preferred; legacy SERVICE_ROLE_KEY preserved)
Classification: VERIFIED (RLS); GAP (legacy fallback preserved by owner authorization)
