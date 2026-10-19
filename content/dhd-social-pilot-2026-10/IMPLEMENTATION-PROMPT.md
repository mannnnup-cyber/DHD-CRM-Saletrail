# Coding AI prompt — DHD content-pack draft import

You are implementing a focused extension to FollOps, not rebuilding its BrightBean Content Studio.

## Locate and preserve the baseline

Repository: https://github.com/mannnnup-cyber/DHD-CRM-Saletrail
Content handoff branch: content/dhd-social-pilot-2026-10
Pack directory: content/dhd-social-pilot-2026-10/
Inspected implementation parent: feat/brightbean-content-studio @ c38d7417e48a64d820b034a65144a01cd1828f06.

Fetch and inspect both branches, current remote heads and any later PA fixes. Read AGENTS.md and the five guardrail documents in its prescribed order, then docs/BRIGHTBEAN-CONTENT-STUDIO-DELIVERY.md and every file in the content pack. Do not regress newer work or reset another user's changes. Make an isolated implementation branch/worktree based on the appropriate current implementation lineage and bring in the content pack. Record baseline SHA and pack SHA. Do not assume the earlier report means the studio is deployed or migration applied.

Use the repo's implementation-agent, independent QA and security workflow. Where GitNexus is available run impact analysis before changing symbols. If unavailable, report the limitation and map callers and tests before edits; do not silently substitute an unrestricted refactor. Respect any stricter repository instruction and report an actual tooling blocker with the unfinished impact assessment. Do not alter model/gateway configuration.

## Product result

Let an authorised DHD owner/manager select this local JSON manifest and its six image files, inspect twelve platform-specific draft intents, and import them into Content Studio without automatically uploading to BrightBean, approving, scheduling or publishing anything.

The pilot has six concepts and twelve variants, one image per variant, two chosen destinations (Instagram/Facebook), a provisional text wordmark, AI concept-mockup disclosures, captions, alt text and proposed America/Jamaica slots. The pack is not approved. No prices, stock guarantee, fixed package, production deadline or comparative solar claim is authorised.

## Existing contracts to reuse

- UI: src/pages/ContentStudio.tsx; client: src/lib/publishing/client.ts.
- Dispatch: /api/social?module=publishing&action=... via src/lib/publishing/server.ts.
- Existing actions include readiness, store, detail, save, upload, submit, approve, schedule, reconcile and recover.
- normalizeDraft in store.ts requires one or two validated accountIds and allows an empty mediaIds array for an incomplete draft. Twelve separate single-account drafts preserve the different IG/FB captions.
- Current upload accepts base64, mime, filename, title and alt. It is a gated provider write, not a local import operation. Reuse it only on a separately authorised upload action.
- Image bounds: one JPEG/PNG per intent, <=2 MiB, <=25 megapixels; Instagram ratio 0.8–1.91. Decode and validate actual bytes, not filename claims. Preserve hashes through upload and approval.
- Approval binds the durable revision, caption, media checksum/version, account and schedule. Edits invalidate approval. No importer bypass.
- Follow current canonical authentication, persisted workspace membership, modern secret usage and database-only privileged access. Never call supabase.from from a page component or expose credentials.

## Required implementation scope

1. **Validate and preview locally first.** Recognise schema_version dhd-content-pack/1; bound payload and item counts; validate unique pack/post/variant IDs, positive versions, platform values, explicit offset times, safe relative asset paths, file size/format/dimensions, actual SHA-256 and required alt/caption fields. Treat captions/manifest as untrusted data, render as text, reject path traversal and unexpected external URLs. No ZIP support is necessary. Match user-selected local files; no server arbitrary URL fetching, GitHub token handling or new public-media proxy.
2. **Map accounts explicitly.** Use authenticated readiness metadata. Let owner/manager select exact currently accessible Instagram/Facebook accounts. Never invent IDs or trust a handle as permission. Validate workspace/platform/account scope server-side. Missing mapping blocks that variant with a clear reason.
3. **Import only drafts.** Show validation results and a twelve-row preview with images, full captions, alt, destinations and proposed Jamaica times. Distinguish proposed time from a scheduled delivery. If dates are stale flag for deliberate correction; do not silently shift them. On explicit import, persist drafts with no approval or provider operation. Missing pending media stays visibly incomplete and prevents approval/schedule. Keep pending local image information available in a reviewable way: browser preview/reselection is acceptable; never write image base64 into social_posts/revisions. A refreshed session must clearly request the file again if pending media bytes are not durable.
4. **Make import durable and repeatable.** Design the smallest additive mapping needed for workspace + pack ID + post ID + variant ID to one local draft, with pack/version/content fingerprint and actor/audit record. Enforce uniqueness transactionally, not localStorage or a list-then-insert loop. Identical retry/reimport and concurrent double click must return the same draft IDs without changing versions. A timeout must be resolvable by reading mapping state. A changed item requires an explicit diff and compare-and-swap revision check; protect manually edited drafts. Never overwrite/recreate submitted, approved, scheduled, published, cancelled, partial or uncertain history through import. Return actionable conflicts and independent per-item results for partial imports.
5. **Separate media attachment.** After preview and migration/release prerequisites, an owner-authorised explicit Upload/Attach action may invoke the existing gated upload flow. Reuse media by exact checksum/workspace and compatible metadata; don't blindly replay uncertain uploads or create duplicate provider media. Attach verified local media IDs through the normal revision flow and invalidate earlier review. Verify the image displayed for approval is the actual uploaded mapping, not just the source local preview.
6. **Preserve release gates.** The request authorises content preparation, code implementation, local tests and review branches. It does NOT authorise hosted migrations, secret/config changes, workspace grants, production deploy/merge, live provider uploads, approval-setting changes or real schedules/publications. Author additive schema changes if needed and test locally. Leave SOCIAL_PUBLISHING_WRITES_ENABLED unchanged. Document the exact remaining release/UAT steps and gate owners. Build all reviewable work before asking for the final required approval.
7. **Keep scope small.** Reuse studio sections and auth; no carousel/video publishing, autonomous content generation, background scheduler, analytics rebuild, alternative publisher or broad CRM redesign. Brand/campaign import must not silently overwrite an existing profile/campaign; propose explicit create/link choices. A per-post manifest alt field must reach upload metadata; report any provider alt limitation rather than claim accessibility delivery without evidence.

## Acceptance checks (behaviour, not implementation mirrors)

- Preview six images and twelve captions; account mapping shown; no provider write occurs on parse/preview/import/reimport.
- Identical import, concurrent imports and timeout recovery produce exactly twelve draft intents, never twenty-four.
- Detect bad schemas, duplicated IDs, mismatched file SHA, >2 MiB, corrupt/truncated JPEG/PNG, out-of-range ratio, missing file/account, stale times and unsafe paths/URLs.
- Deny unauthenticated users, reps, cross-workspace mappings and unauthorised accounts.
- Changed pack yields a deliberate diff, protects manual edits, uses revision compare-and-swap, and cannot mutate approved/scheduled/published/uncertain history.
- Empty-media imports remain incomplete. Gates block provider uploads when disabled. Upload uncertainty never causes an automatic second provider write. Media replacement forces new review.
- Existing submit/approve/schedule/reconcile semantics remain intact, with separate destination receipts and no false 'published' claim.
- Test at least one complete local UI flow with synthetic data: select pack/files -> map -> preview -> import -> repeat -> open draft -> confirm missing-media status. Verify relevant API/database behaviour together, not mocks alone where transaction uniqueness matters.
- Run the relevant existing publishing suite, new importer behavioural tests, TypeScript and production build. Record actual commands/results; do not reuse historical pass counts as today's evidence.
- Independent QA/security review per AGENTS.md; record unresolved issues, including any pre-existing ones separately.

## Delivery

Commit code, tests, any additive migration and relevant context docs to the isolated implementation branch. Push that branch for PA review; do not merge/deploy or perform live actions. Report baseline/final SHA, changed files, commands/results, importer mapping and pending-media design, six concepts/twelve draft expected outcome, review findings, and the remaining hosted migration/media-upload/live-publication gates.

Finish with: DHD CONTENT PACK IMPORT READY FOR PA REVIEW only if the acceptance checks pass. Otherwise state precise blockers and completed reviewable work. Do not tell the owner anything has been scheduled or published.

