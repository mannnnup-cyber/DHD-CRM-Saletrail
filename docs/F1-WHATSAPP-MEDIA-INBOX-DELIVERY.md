# F1 — local delivery evidence

Baseline `37a7253910c8541fbc35a296ee3371b848f28051`. Feature branch `feat/f1-whatsapp-media-inbox`. Publication and PR preparation are authorized; merge and deployment are not. No hosted schema/configuration changes or customer/provider messages were performed during implementation.

## Implemented

- Shared Evolution media sender initializes before direct switch dispatch. Narrow fresh active-role media send/proxy authentication and bounded server validation are independently owned and reviewed in this packet.
- WhatsApp-only App scroll ownership; independently scrolling conversation panes, mobile Back navigation and reachable composer.
- Anchored bounded conversation search; debounced cancellation/sequence suppression and literal/relevant server matching. Global CRM search is unchanged.
- Document cards retain available bounded filename/MIME/size, including body markers. Unknown metadata remains unknown. No full raw provider object is exposed.
- Three MiB raw attachment cap, encoded payload cap, preserved file/caption on known rejection/read failure, current Bearer dispatch, captured session/chat/file, no automatic resend, visible uncertain outcomes.
- Every WhatsApp avatar/image/audio/video/gallery/lightbox/download remote consumer uses authenticated bounded blob fetching with cancellation and URL revocation. Local previews are revoked on actor/chat/unmount transitions.
- Private attachment drafts are bound at selection time and cleared/hidden immediately on session change. Late dispatched outcomes retain only generic reconciliation guidance.
- Media is demand loaded: images near the viewport, explicit Load controls for documents/audio/video, and at most two simultaneous browser media fetches. Browsers without visibility observation require an explicit image click. No private persistent cache or shared API-rate-limit increase is introduced.
- Each active media fetch/body read has a 25-second deadline starting after queue acquisition. Timeout cancels streams, releases queue capacity, displays unavailable and ignores late responses; no automatic retry.
- Existing assignment user ID is retained in loaded chats so the existing Mine filter can operate. No identity inference or permission expansion.
- New chat history is positioned instantly before paint, avoiding media requests while scrolling past old images. Fresh polling preserves the current viewport; only the existing near-bottom policy scrolls refreshes.

The donor047 text-send draft-restoration expectations were excluded because that behavior is absent from the approved baseline and outside the selected donor scope. All eleven original labels/unread tests remain; a text-dispatch compatibility test was added. Baseline text delivery semantics were not changed.

## Evidence status

Final regression on 2026-11-04 after the scrolling correction: **453/453 tests across 29 files PASS** (86.29 seconds, Node 24.19.0, one worker, bounded timeouts). This includes 53 actual-handler media tests, 50 settings-containment tests, 10 scope-preservation tests, native emitted ESM startup, 21 WhatsApp DOM tests, 11 protected-media tests and six attachment-metadata tests. Existing labels, personal unread, Settings, email and Social Inbox regression suites pass. Five legacy proxy tests now authenticate an owner before checking the existing no-credential-forwarding contract; redirects are explicitly rejected. The earlier 452-test run is superseded. A default-timeout cold-start failure and an unresponsive cached-runtime launch were not treated as successful checks or as application defects.

Final TypeScript `tsc --noEmit` PASS (exit 0). Final Vite production build PASS (2,786 modules, 75 seconds). The initial sandbox build could not spawn esbuild (`EPERM`); the same build passed after process permission was granted. No source change was needed for that environment failure.

Independent scoped security/code review PASS: fresh active-role/project verification before private effects; bounded input/output; session-bound drafts; cancelled late responses; demand loading; queue deadline; credential redaction and uncertain-send behavior. Browser acceptance is recorded separately below. Synthetic fixtures do not verify live provider delivery, hosted role behavior or production latency.

2026-11-04 final Chromium acceptance: **19/19 PASS**, with identical before/after source hashes. Actual App/Sidebar/WhatsApp at desktop 1366×768 and mobile 390×844; all API calls intercepted with synthetic fixtures and external traffic blocked. Verified fixed composer, mobile back/list navigation, 65 exact historical text messages, named PDF blob download, bounded search/Escape, 400/401 draft preservation, oversize rejection before HTTP, uncertain-send reconciliation, actor-change draft removal, all four supported-role UI fixtures, labels and personal unread. Opening 180 image messages now makes two proxy requests instead of the earlier 68 during animated scrolling. Expected fixture errors were 400/401/503 only. Independent source review passed the final scroll correction; local artifacts remain outside Git.

React best-practices checklist applied: bounded effects/dependencies, cancelled stale requests, memoized timeline, keyboard/back controls, no authorization component redesign or broad refactor. GitNexus media symbol target was missing; static HIGH blast radius was communicated before editing. No graph safety claim.

## Remaining boundaries / release sequence

Legacy unrelated text/history/provider callback/GSM/recording trust-boundary issues remain outside F1. Historical credential exposure is not resolved by this patch. The preexisting URL-mode media proxy still accepts arbitrary HTTP/HTTPS targets, including private hosts: fresh authentication and no provider-key forwarding reduce exposure but are not an SSRF allowlist or network isolation. A separate compatible URL/network policy is needed. No new database schema or hosted environment variable is required. Existing privileged values never belong in browser URLs or reports.

Compatibility limits: decoded outgoing attachments are capped at 3 MiB; browser/proxy media reads are bounded at 4,400,000 bytes. Larger existing media may show unavailable. Provider and URL-proxy redirects are rejected; redirect-dependent CDN links may require a fresh direct provider result. Documents retain generic business MIME support; SVG/HTML are not rendered inline. Evolution media/audio contracts are preserved; active Green API media is rejected safely rather than dispatched using Evolution credentials. Green text behavior is unchanged. Token changes clear staged private drafts. Uncertain provider or persistence responses are never automatically retried; users must reconcile history before retrying. This is not durable provider idempotency.

Publication uses the exact feature branch only, with `vercel.json` disabling automatic Git deployments for that branch. The redundant push webhook must remain inactive. Other branches and master configuration are unchanged. No preview is expected; GitHub CI and deployment records are checked after publication.

After PR review, obtain separate merge/deployment authorization. Production acceptance must verify the deployed SHA, anonymous/invalid-token denial, owner/manager/rep/sales_rep media access, an owner-controlled text/image/PDF/audio exchange, received attachment download, known failure and uncertain-outcome handling, and labels/unread/history/search on desktop/mobile. No live customer message was sent. Roll back application-only through a reviewed corrective revert preserving SECURITY-001A/B and authenticated media controls; do not return to unauthenticated media. No database rollback is needed.
