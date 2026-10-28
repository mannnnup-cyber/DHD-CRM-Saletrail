# WP-WHATSAPP-INBOX-UI

Status: Done locally; preview publication only. Date: 2026-10-28. Implementation owner: comms_finish_impl. Baseline 047beafcc643e9a31a2d54218d1526993164de2d, branch fix/whatsapp-inbox-ui. Existing worktree preserved; root owns delivery report and visuals.

## Scope and impact

Owner authorized inbox usability polish after confirming preview media sending. Manual HIGH impact warning to root before App/shared wrapper edits: route-specific height/scroll ownership, local search lifecycle, attachment async completion and narrow metadata display. GitNexus tools/index unavailable/incomplete; manual callers + tests + independent QA/security govern. Required context and React guidance read. No backend auth/device/call redesign.

App route-aware min-height chain, WhatsApp responsive list/conversation navigation, anchored bounded search, cancellation/debounce/stale guards, protected attachment names/cards, FileReader/current-chat guards and blob cleanup. Keep credentials and customer data out of all tests. Narrow existing JSON scalar projections only; never full raw messages or new columns. Upload raw3MiB and encoded4.4MB conservative platform limits, bounded filename/caption. Do not claim INP improvement without measurement.

## Verification / restrictions

Focused UI/helper/actual-handler regressions, TypeScript and independent QA/security required. Root QA owns final full/build and synthetic desktop/mobile visuals. No real message, upload, call, provider operation, hosted SQL, settings, push, merge or deployment. No commit by implementation agent.
Focused verification: 143/143 passed across UI (18), actual handler (119), attachment helpers (6), serial Vitest. Native emitter glob includes attachments.ts automatically. Parent preliminary TypeScript passed before final test additions; independent final QA/type/build and synthetic browser checks pending. No hosted/provider activity. Source frozen for independent review; no commit.

Final evidence: full456/45625files53.25s PASS onfunctional freeze; after2cosmeticclasses UI18/18PASS7.89s,typePASS,buildPASS2786modules1m49s1307.10kB/gzip348.06kB. Independent scoped QA/security PASS. Actualcomponent syntheticdesktop/mobile/search checks passed (representative shell, notfullApp/hostedINP). Finalized by root; only root may publish isolatedfeature forreview, no mastermerge/productionrelease orrealprovideraction. Implementationagent made no commit/push.
