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

## Final correction and conditional release — 2026-11-04

Owner conditionally authorized release after all final gates pass; this supersedes the earlier PR-only authorization, not the unresolved acceptance gates.

- Confirmed P2 cause: `ProtectedDownload`'s initial button discarded the supplied click handler. Both the load button and loaded anchor now invoke it; caller cancellation is honored. The actual lightbox stays open through load and download. Two component regressions cover propagation/cancellation; committed `tests/browser/f1-regressions.mjs` provides actual lightbox and bounding-rectangle assertions reused by the existing synthetic browser harness.
- The WhatsApp root now explicitly grows as a flex child instead of depending on percentage height. `App.tsx` needed no further changes. Independent history scrolling, composer anchoring, mobile and unrelated page scrolling remain covered.
- The owner's 100%-zoom production screenshots clarified the apparent half-height symptom: existing content moves upward and leaves blank space below. Legacy delayed `scrollIntoView` can move `overflow:hidden` ancestors. The controlled constrained-content test reproduced a 256 px header displacement in baseline code. F1 now clips only WhatsApp's outer shell/content/main, retains its independently scrollable message history, and positions messages without ancestor scrolling. Under the same stress F1's header and outer scroll offsets remain zero. An ordinary baseline fixture alone did not show the displacement; this is a controlled mechanism reproduction supported by the screenshots, not a direct measurement of the owner's Firefox DOM.

| Viewport | Main bottom | Page bottom | Composer bottom |
| --- | ---: | ---: | ---: |
| 1366×768 | 768 | 768 | 751 |
| 1440×1080 | 1080 | 1080 | 1063 |
| 1366×635 | 635 | 635 | 618 |
| 390×844 | 844 | 844 | 835 |

Final browser regression: **26/26 PASS**, identical before/after source hashes, all original media/search/labels/unread/scroll cases retained. Dimension checks wait through the legacy delayed-scroll period and verify header, document and app-shell offsets, including constrained native scrolling. Independent follow-up code/security review PASS, with API/authentication and previous safeguards unchanged. Final full regression **455/455 tests across 29 files PASS**; TypeScript and production build PASS (76.95 seconds). The component test emits jsdom's expected download-navigation limitation; actual Chromium download behavior passes. Exact-SHA CI remains the pre-merge gate. Runtime checks and generated artifacts remain outside Git; no new package, migration, secret, hosted setting or provider/device change.

**Access blocker superseded:** the connector/CLI still lack team access, but the signed-in Vercel browser now verifies the correct project, production domain, master source and existing production deployment `5WRQCTaZKkbEXZxEriGDJ7gmBNY8` (`37a7253910c8541fbc35a296ee3371b848f28051`, Ready). Its overview confirms master is the normal production path. Conditional owner release authorization remains valid; only merge after exact-SHA CI and remaining preflight gates pass. No customer messages, credentials, database records or provider configuration were changed.

## Production closeout — 2026-11-04

**F1 production release COMPLETE; safe acceptance PASS, live provider exchanges NOT VERIFIED.** This section supersedes earlier pending/blocked states.

- PR #24 merged under the owner's conditional authorization after all gates passed. Tested PR SHA: `cb5f5a724fc927cf4f934e569b7572584f1c6551`. Merge/master/production SHA: `4146af4ecca70a0fea46b43a2e9475a251727045`. Merge parents are the expected baseline and tested head; the merge tree exactly matches the tested tree. No other release was included.
- Local 455 tests, TypeScript, build and 26 desktop/mobile browser checks passed; independent review passed. Exact-head GitHub CI run `41928005544` and master CI run `41928260000` both passed. The P2 lightbox thread is resolved.
- The normal native Git integration produced one production deployment: `dpl_FkfDHEyJnrHEvvoUJvkw9G88Sx4W`, deployment URL `https://dhd-crm-saletrail-9jerg1uvb-mannnnup-cybers-projects.vercel.app`. Signed-in Vercel details verify **Ready / Production / Current**, master source `4146af4`, and domain `https://dhd-crm-saletrail.vercel.app`. No Deploy Hook was invoked and webhook `641005278` remained inactive.
- Production smoke PASS: public app HTTP 200 contains the new WhatsApp layout marker and clipping; anonymous settings, alternate Evolution configuration, media reads and synthetic empty media sends all return HTTP 401 with only generic response keys. These requests did not dispatch messages. A fresh authenticated owner Settings tab loads successfully without a role-denial message. No real customer messages, calls, label changes, data edits, migrations, credential rotations or provider/device configuration changes were performed.
- Vercel selected Node `26.13.0` because the preexisting `engines.node >=22` range permits automatic major upgrades. Production build and the above real runtime checks passed. The supplemental isolated Node 26 full suite is **NOT VERIFIED**: downloading the official runtime failed with a remote connection reset; no local Node 26 test result is claimed. The passing full suites ran locally on Node24 and in CI on Node22. Independent review classifies this as environment compatibility drift, not a confirmed F1 defect or reason for blind rollback. Runtime pinning/CI alignment requires a separate scoped change; no runtime setting was changed during F1.
- Remaining acceptance: owner refreshes the production page at 100% zoom and confirms the existing Firefox conversation stays anchored; real image/document/audio delivery, receipt and download need a separately authorized owner-controlled recipient test. Local mocked provider success and synthetic browser tests do not prove those live exchanges. Shared-channel privacy, legacy route security, URL-proxy SSRF and historical credential incident remain outside F1.

Final documentation/task updates are published on the guarded feature branch after deployment; they do not change the deployed application tree or trigger another production build.
