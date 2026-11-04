# F1 — WhatsApp media and inbox

Started 2026-11-02. Branch `feat/f1-whatsapp-media-inbox`; exact baseline `37a7253910c8541fbc35a296ee3371b848f28051`. Local implementation and independent verification only; no production release authorized by this packet.

## Scope

Extract minimal reviewed media helper initialization and inbox layout/search/attachment-card functionality from 6d1ac1 and ea72cf8/269d253 onto current master. Preserve001A settings authorization and001B future-payload/log redaction, phone labels, personal unread, PN/LID/history behavior and current legitimate staff roles. Do not import047beaf's broad owner-only communications gate. No Android, Woo, Studio, database/provider changes or customer sends.

The helper fix enables previously broken writes. Consequently the bounded F1 media send/proxy routes require fresh active owner/manager/rep/sales_rep identity; matching-role policy is preserved without inventing assignment rules. All corresponding browser proxy consumers use Bearer headers and actor-bound revocable blob URLs. Broader legacy text/history/callback authorization remains explicitly outside this packet.

## Acceptance

- Actual-handler positive/negative text/media validation, provider failures, uncertain outcomes, native emitted API startup.
- Actual WhatsApp DOM lifecycle/search/navigation and existing labels/unread regression.
- Authenticated bounded media blobs, cancellation/late response/session changes and cleanup.
- Independent desktop/mobile actual App fixtures, scoped security review, final full tests/type/build.
- No automatic resend; unknown dispatched outcomes require reconciliation.
- Exact branch-only Vercel deployment-disabled guard, preserving master configuration.

## Risks / stop conditions

No local fixture proves real provider delivery or production deployment. Existing anonymous communications/machine boundaries remain open. Unknown provider/persistence outcomes must never be falsely acknowledged or automatically resent. Stop release for auth regression, secret leakage, role breakage, unintended diff or deployment ambiguity. Root coordinates all publication/release authorization.

GitNexus symbol target unavailable; static HIGH impact was reported before edits. Exact diff, scoped preservation tests and independent source reviews replace unavailable graph assurance; they do not prove dynamic provider behavior.

## Local implementation closeout

453/453 tests (29 files), TypeScript and production build PASS. Independent scoped code/security review PASS. See delivery report for final browser and PR/CI evidence. Implementation complete; production release and live acceptance remain pending separate authorization. No customer/provider messages, hosted mutations, merge or deployment.
