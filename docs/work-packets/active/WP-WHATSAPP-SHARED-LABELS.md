# WP-WHATSAPP-SHARED-LABELS
Status: Review. Owner: integration specialist; independent QA/security completed; live rollout pending.
Baseline origin/master666210208ca07b92fb8c50f23d1bd7b1fe859cc5, isolated work/whatsapp-shared-labels, branchfeat/whatsapp-shared-labels.

## Revised plan: use existing supported API, no provider deployment
New evidence supersedes the initial Docker patch proposal: official2.3.7 GET /chat/findChatByRemoteJid/:instance?remoteJid=... returns Chat.labels today. A safe live read returned200, exact requested chat and one label ID. Tagged router and channel.service.findChatByRemoteJid scope the lookup by configured instanceId+remoteJid. No Render GitHub grant, provider patch, registry, database bridge, restart or upgrade is required. Unshipped patch artifacts removed.

1. Add authenticated owner/manager CRM association read action, up to25 supported chat IDs, concurrency4, per-call timeout/response limit/redirect rejection and strict returned-JID equality. Project only chatId and labelIds; missing/null/malformed/failing records are UNKNOWN, verified[] is unlabelled.
2. Demand-load the first25 conversations when labels are opened/checked; explicit Check next25 and Refresh checked controls. Do not fan out414 calls on initial inbox load or30-second chat polling. Cache reads for3 minutes by providerorigin+instance+keyidentity+JID, bounded size. Expired UI data becomes unknown; no background provider polling. Label filter reports checked coverage and excludes unknown only explicitly, with an Unknown option.
3. One phone-label menu, one filter, at most2 chips +N. Preserve IDs/names/color codes, duplicate names distinct. No second CRM label catalog, auto-merge, rename, deletion or replacing all assignments. Status and team assignment stay separate.
4. User-driven single-label add/remove only after verified live readback and independent review; direct phone-number JIDs only, existing provider label required. Fresh provider read before any write, expected target membership check, explicit mutation then fresh readback. No stale cache authority, no automatic mutation retries. Uncertain outcome blocks further UI changes until refreshed/reconciled. No real customer label mutations in tests or by the agent.
5. Synthetic server/UI tests for access/bounds/cross-instance isolation/privacy, known/unknown/filter/chips, cache/races, individual operation/readback uncertainty. QA/security, type-check/build and concrete PR review before release.

## Backup and capability evidence
Existing managed Aiven backup61MiB after pairing was observed by lead. Fresh logical public-schema+roles backup created securely outsideGit with nativePG18.6;37 tables including1Instance/1Session/9Labels. Read-only aggregate found1193Chats,542non-null labelJSON,525nonempty (no names/IDs printed). Recovery not yet claimed; no paired-runtime change is planned. CRM backup/migration from prior packet remains separate; BrightBean stays paused.

## Constraints / boundaries
Fresh JWT + active canonical owner/manager, modernSUPABASE_SECRET_KEY only; fixedconfiguredprovider/instance, server-keyenv-first, no private fields/credentials in responses/logs. Unsupported chat IDs retained in inbox with unknown labels. No broad legacy endpoint/auth rewrite or hosted DDL. No provider deployment, credential/billing changes or publishing operations.

GitNexus WhatsApp impact LOW0indexedcallers/processes. New helper missing from old graph: reindex started before existing helper edits; report actual impact before changes. Source https://github.com/EvolutionAPI/evolution-api/tree/2.3.7 . Original inaccessible bulk projection did not prove per-chat readback absent; this discovery corrects that earlier assumption.

## Independent review and rollout record
QA PASS and security PASS for staged read-only release: 45 targeted tests (33 API/helpers, 10 actual-page DOM, 2 deferred hook race tests), type check, and production build passed. Read/write races, uncertainty reconciliation, default-disabled server gate, projection/privacy, bounded requests, checked-only filtering, expiry, and two-chip display were independently reviewed. GitNexus-generated skill changes were excluded.

Deployment sequence: push reviewed branch, pass CI, merge and verify historical assignments in the live CRM with writes disabled. Only after successful live readback may WHATSAPP_LABEL_WRITES_ENABLED=true activate owner/manager single-label operations. No real customer label mutation is part of agent validation. No provider image, database schema, registry access, credential or billing change is required. Process-local locks and throttles are not distributed serialization. Final live evidence will be recorded in the release PR.
