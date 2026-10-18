# WP-WOOCOMMERCE-REPAIR

Status: Review. Owner: woo_implementation. QA and Security: mandatory independent review.

Baseline: origin/master b6f8dbcc9d9853d61e706d02ad43633ce164422c.
Worktree: work/woocommerce-fix; branch fix/woocommerce-sync. Authoritative repository:
C:/Users/Administrator/DHD-CRM-Saletrail. One implementation agent owns code.

Scope: authenticated active owner/manager Woo API, fail-closed raw HMAC webhook,
bounded trusted-origin REST reads, shared canonical woo_orders projection,
resumable initial and modified-order catch-up batches with atomic durable lease,
truthful failures and counts, stored-order UI without browser private-data cache.
Preserve payment/refund/custom statuses; no automatic lead/deal creation.

Migration is authored for review only; lead approval and independent security
review precede hosted application. No existing RLS/grants changed. New state and
RPC are modern-secret server-only, security invoker, deny public execution.
No credential rotations, store mutations, customer messaging, global auth redesign,
or production data access by implementation agent.

Risks: graph reports LOW direct impact (Woo route, handler, signature helper),
but runtime/security risk HIGH: private orders and webhook persistence. Existing
contact/profile consumers must retain canonical columns. Generic handler index
ambiguous; exact file context and static caller checks supplement impact.

Plan: (1) migration proposal; (2) server helper/auth/fetch/projector/batch and
webhook; (3) authenticated saved-order UI; (4) synthetic actual-handler/runtime,
signature, pagination, stale-update and failure tests; (5) full checks and reviews.

Acceptance: public/rep/inactive requests denied; invalid/missing signatures and
missing secret cannot write; exact bytes checked before JSON; no provider query
secrets or redirect following; canonical conditional upsert never overwrites a
newer snapshot; lease protects batch overlap, failed batches retry same checkpoint;
bounded pages eventually finish initial import and use incremental modified window;
UI reports saved count/errors and reads existing saved orders during upstream
outage. Live store authentication/import/webhook delivery remain lead release checks.

Rollback: revert deployment; retain existing orders and additive migration state.
Never delete customer orders as rollback. Scheduled worker fails closed without
CRON_SECRET. No QA claim about hosted behavior from mocks alone.

Implementation report: narrow contacts Woo-only bypass closure included by lead scope extension. Original manual lead/deal, print/export and customer/detail controls retained. Unknown custom statuses require explicit manual stage choice. Daily cron (Hobby-compatible), explicit up-to-200 bounded requests with Stop/resume, current orders first. Migration proposal only; no hosted operations by worker. Targeted actual handlers/UI/native ESM: 40/40 passed. Full type-check/build and independent QA/security pending. No GitNexus detect_changes tool exposed; git diff/status/diff-check scope fallback used.
