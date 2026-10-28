# WhatsApp inbox UI follow-up

Started 2026-10-28 (America/Bogota). Branch: fix/whatsapp-inbox-ui. Baseline: 047beafcc643e9a31a2d54218d1526993164de2d (browser access-control repair). LOCAL UI IMPLEMENTATION COMPLETE — QA/security PASS; feature publication for preview only. No production release implied.

## Owner evidence and scope

The owner reports media sending now works on the communications preview. This is owner-reported functional evidence, not a new automated real-provider test. Screenshots show a Chats results overlay spanning the application, substantial blank space below the inbox/composer, a generic Attachment bubble and performance-overlay INP warnings of 208.1ms/936ms. Customer names/numbers are not copied into this report.

Source inspection confirms the WhatsApp unified-search dropdown is absolutely positioned outside its input's relative wrapper; the inbox uses a hardcoded calc(100vh - 340px) while the application main region also scrolls. These explain concrete layout risks, not a measured attribution for every slow interaction. A local attachment preview uses a blob URL and filename in text, but loaded message formatting can collapse bracketed filename text to a generic attachment. The implementation will preserve available metadata instead of claiming unknown filenames.

Bounded work: anchored responsive search results and cancellation/stale-result handling; a viewport-filling WhatsApp workspace with independent pane scrolling and reachable composer; useful attachment presentation/downloads; correct attachment pending/failure/chat-switch handling and object-URL cleanup. Preserve authenticated media, owner/manager gates, no arbitrary URL proxy, no token URLs and existing customer/provider records.

No automatic messages, file sends, calls, label mutations, provider operations, hosted SQL/configuration, merge or production deployment are permitted for this UI validation. Use synthetic fixtures for tests. After passing review/checks, publish only the isolated UI feature branch for the ongoing preview review; native Vercel preview generation may occur. Existing device/webhook/Storage security blockers and call lifecycle limitations remain outside this packet.

Attachment limit correction: the existing4MiB raw limit can produce over5MiB of base64 plus JSON. Vercel documents a4.5MB function payload limit. The UI must use a conservative3MiB raw cap with bounded text metadata and verify encoded payload size before dispatch, rather than promise that every4MB file can pass. Larger-media storage/streaming is a separate design. [Official function limits](https://vercel.com/docs/functions/limitations), [payload-too-large error](https://vercel.com/docs/errors/function_payload_too_large).

## Verification

Frozen implementation:

- App uses a dynamic viewport and WhatsApp-only min-height/scroll ownership. The owner/manager wrapper supports the full-height chain without changing its authorization. WhatsApp panes scroll independently; the composer remains in the conversation pane. Mobile switches between list and conversation with a Back control. Programmatic message scrolling targets the message viewport rather than scrolling ancestors; polling preserves a reader's non-bottom position.
- Search results are anchored in the chat-search container, width/height bounded and keyboard/outside/Escape dismissible. Debounced requests are aborted and sequence-checked; closing, query/tab changes invalidate results. Server search validates query/pagination and escapes literal filters while selecting only needed display columns. The global CRM search's business scope is not expanded.
- The WhatsApp route boundary is memoized to avoid unrelated parent header-search redraws, and the merged message/call timeline is memoized. These are reductions in avoidable work, not proof of an INP target.
- New attachment helper maps bounded filename/MIME/size from existing body markers or narrow existing JSON scalar projections; no full raw provider object is returned and no column/migration is added. Unknown metadata stays unknown. Message-query errors now return an explicit unavailable response instead of an empty history.
- Document cards show available filename/type/size and protected download; image/media rendering retains the authenticated path. File reads and uploads capture file/chat/caption/session; changed sessions or chat/file state cannot silently dispatch/paint a different conversation. Read failures retain the draft. Unknown post-dispatch outcomes lock resubmission with reconciliation guidance. Object URLs are revoked on replacement, chat change, lightbox cleanup and unmount. No automatic resend.

Focused tests: **143/143 PASS** (18 actual WhatsApp DOM tests,119 actual-handler tests, six attachment-helper tests). New cases specifically cover layout/back navigation, oversize-before-read, asynchronous read failure, session change before/after dispatch, Escape focus behavior, bounded metadata/error responses and search input bounds. Other race/cleanup paths were source-reviewed and must not all be described as individually automated cases.

Independent full suite: **456/456 tests,25/25 files,53.25s PASS**. TypeScript also passed. After this run, only two cosmetic class strings changed: scoped dark native controls/scrollbars and functional horizontal filter-scrollbar hiding. Overflow/keyboard access remains. A targeted UI rerun, final type/build and screenshots validate that final cosmetic state below; do not describe the full run as occurring after those class changes.

Independent scoped security: PASS on the functional frozen source; cosmetic-delta scoped review also PASS. No new blocking finding; existing machine/webhook/Storage risks are unchanged.

Visual evidence uses actual WhatsApp component, CommunicationsAccess, ProtectedMedia and hooks in a **representative synthetic shell**, not the complete production App/Auth/data providers. Desktop1366x768 and mobile390x844 fixtures are outside Git. Exploratory early screenshots were taken during HMR edits and are not an immutable before/after benchmark. Final captures require a hard reload after freeze. App shell changes are source-reviewed; component DOM tests are not full-App visual acceptance. Do not claim an INP improvement from class changes or a passing DOM test alone; production interaction latency requires measured before/after evidence.

## Final results and limitations

Post-cosmetic targeted WhatsApp DOM rerun18/18 PASS7.89s; final TypeScript PASS; production build PASS exit0,2,786 modules,1m49s,index.html1,307.10kB/gzip348.06kB. Independent functional QA PASS and scoped security PASS. The final test EOF whitespace cleanup was semantic-free; no functional changes followed the reviewed freeze. Git diff/check PASS; no dependencies, hosted schema, environment or deployment configuration changed.

Synthetic desktop1366x768 checks: workspace208..752, composer680..751; search popup aligned to input x285,width294,top265,bottom649, no horizontal page overflow. ArrowDown and Escape/focus behavior passed. Mobile390x844: document width390; page64..844,workspace276..836,composer764..835; Back returns to conversation list. Final PNGs outside Git: artifacts/whatsapp-ui-review/desktop-attachment-after.png,desktop-after.png,mobile-after.png,mobile-list-after.png,search-after.png. These exercise the real component in a representative synthetic shell; they are not full hosted-App acceptance or a production INP measurement.

Existing rows without recorded filenames/sizes retain generic Document/unknown metadata rather than fabricated values. URL-only protected-media restrictions from the browser security packet remain. Existing device/webhook/Storage and call-tracking limitations remain outside this UI packet. A code rollback would be a reviewed branch revert; no database rollback is needed. Preserve the underlying browser security commit047beaf; never roll back to unauthenticated media behavior as a UI workaround.

Final private bundle scan: two available configured privileged values checked, zero matches; sb_secret prefix zero matches. Values were not printed. This is a bounded sample, not a global secret audit.
