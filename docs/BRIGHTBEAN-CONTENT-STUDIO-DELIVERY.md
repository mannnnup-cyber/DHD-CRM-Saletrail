# FollOps BrightBean Content Studio delivery

Assessment date: 2026-10-19. Branch: `feat/brightbean-content-studio`.
Base: `b6f8dbcc9d9853d61e706d02ad43633ce164422c` (master).

This is a local implementation for PA review, not a production release. No merge, push, deployment, hosted migration, real provider upload, schedule, publication, reconnection or approval-setting change was performed for this build. Live delivery remains a separate owner-authorized UAT gate.

## Implementation and phase history

| Phase | Commit | Delivered |
| --- | --- | --- |
| BB-01 | d38b7e7bd66013b82ad582e545462c1ed985a0af | Authenticated readiness, scoped media listing and known-post reads |
| BB-02 | 6ac7bacd3bf360f58781f6154e8ec821ceb7efcd | Additive schema, workspace memberships, durable revisions, approvals and operation claims |
| BB-03 | ca8d86d3c98cc6231ab2d7a756f66f43ecdcdf02 | Image composer, upload mapping, owner-approved single-account scheduling |
| BB-04 | 40429fc00165508a7be8ad5d9193491e8c19af65 | Calendar, independent destinations, status verification, cancellation and recovery |
| BB-05 | 3bbeb8ae1136fef1fecedcd60d654be5638ccfb5 | Brand profiles, campaigns and editable AI suggestions |
| BB-06 | Delivery commit; resolve with `git log --grep=BB-06` | Analytics, manual CRM evidence, image review, security hardening and regression coverage |

Earlier phase commits are review checkpoints; safety corrections are included in BB-06. Review the complete branch, not an intermediate phase as a deployable release.

### Changed-file inventory

- Routing: `api/social.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`.
- UI: `src/pages/ContentStudio.tsx`, `src/components/PublishingCalendar.tsx`, `ContentPlanning.tsx`, `PublishingAnalytics.tsx`, `PublishingPreview.tsx`.
- Server: `src/lib/publishing/provider.ts`, `server.ts`, `store.ts`, `commands.ts`, `ai.ts`, `analytics.ts`.
- Browser helpers: `src/lib/publishing/client.ts`, `calendar.ts`.
- Persistence: `supabase/migrations/20261018000100_brightbean_content_studio.sql`.
- Dependencies: `package.json`, `package-lock.json`; exact production pins `pngjs@7.0.0`, `jpeg-js@0.4.4`, test-only `@electric-sql/pglite@0.5.10`.
- Tests: `tests/publishing-readiness.test.ts`, `publishing-handler.test.ts`, `publishing-provider-contract.test.ts`, `publishing-commands.test.ts`, `publishing-sql.test.ts`, `publishing-preview.test.tsx`, updated `social-runtime.test.ts`.
- Documentation: this report, the work packet and matching `docs/context/` documents.

The existing Social Inbox server, Email Inbox, WhatsApp and unrelated CRM modules are unchanged. The publishing dispatcher is an explicit `module=publishing` branch in the existing social function; the project still has twelve API entry points.

## UI and API

Route: `/#/content-studio`, visible to owner/manager. Sections: Dashboard, Calendar (month/week/list), Composer, Approvals, Scheduled, History, Media, AI Studio, Brand, Campaigns, Analytics, Health.

All requests use `/api/social?module=publishing&action=...`, a fresh bearer identity, canonical active role and server-only modern Supabase secret. Private workspace actions require persisted membership. Readiness exposes bounded connection metadata for bootstrap; it does not establish publishing readiness.

| Method | Actions |
| --- | --- |
| GET | `readiness`, `media` (bounded cursor), `mediaPreview` (local media ID), `knownPost` (provider ID), `store` (50 rows, exact DB count), `detail` (local post ID), `analytics` (local post ID), `report` |
| POST JSON | `initialize`, `grant`, `revoke`, `save`, `submit`, `approve`, `reject`, `upload`, `schedule`, `cancel`, `reconcile`, `recover`, `brand`, `campaign`, `ai`, `attribution` |

`save` takes an optional local `id`/`version`, caption, firstComment, accountIds, mediaIds, scheduledAt with explicit offset, campaignId. The server supplies actor/workspace/account platform. Existing revisions require compare-and-swap version. `schedule` takes local id/version/accountId; content comes exclusively from the approved durable snapshot. `cancel`/`reconcile` also require a requestId. Owner-only `recover` takes operationId, providerId and explicit mediaAndScheduleChecked attestation; it reads the existing provider record and never creates another post.

Only one JPEG/PNG image is supported per intent, at most 2 MiB and 25 megapixels. PNG CRC/full decoding and bounded JPEG decoding reject corrupt inputs. Byte SHA-256 plus provider ID/version enters the approved snapshot; binaries and signed preview URLs do not enter ordinary database rows. Instagram additionally requires an approved image and supported aspect ratio.

The owner review shows full caption, first comment, exact image, accounts and Jamaica time. Approval is disabled until the selected image has loaded. Every saved change creates a new revision and invalidates prior approval. Managers prepare/submit, upload and verify status; owners approve (including their own posts), schedule, cancel and recover. Other roles are denied. This does not prevent direct publishing or changes in BrightBean Studio.

## Database and operation safety

Migration authored only, NOT applied to hosted Supabase. It creates thirteen tables: social_workspaces, social_memberships, social_brands, social_campaigns, social_media, social_posts, social_revisions, social_approvals, social_operations, social_deliveries, social_audit, social_attributions, social_ai_suggestions. Six invoker functions with empty search_path: social_require_actor, social_command, social_claim, social_finish, social_recover, social_report. RLS is enabled on all new tables; browser roles have no table/RPC grants. Server service access is explicit. No existing policies are weakened.

Only the seeded DHD workspace can be initialized, by an active owner. That owner explicitly grants other active owners/managers access. Future workspaces need reviewed provisioning, not arbitrary client workspace IDs.

Approvals bind canonical JSON content, media SHA/version, account/platform, UTC scheduled time and publishing settings using database-computed SHA-256. An advisory lock, row locks, version checks and unique per-revision/destination creation enforce duplicate prevention. A durable claim precedes every provider write. Lease tokens fence completion; expired or uncertain results cannot trigger an automatic replacement. Cancellation/reconciliation on one destination are serialized. Platform receipts and provider IDs are bound to the expected mapping; native published ID and publication timestamp are required for a published claim.

Each selected account receives its own provider post/operation/delivery. Facebook success and Instagram failure remain independent and aggregate to partial. Published receipts cannot be downgraded by stale reads. Cancelled old revisions retain their historical delivery rows. A definite rejected creation with no delivery can be edited into a fresh unapproved revision; known or uncertain deliveries require verification/cancellation instead.

Uncertain creation without a known ID requires owner inspection in Studio, not an automatic retry. Recovery verifies the known record and available content/time, and explicitly requires owner media/schedule attestation because the provider read contract does not expose an immutable attachment checksum. Uncertain media uploads remain stopped for operator investigation. Successful upload replay can recover a missing local mapping with the same byte/metadata identity. No durable work is entrusted solely to in-memory queues.

## Verified provider contract and limitations

Contracts were checked against hosted OpenAPI and official BrightBean source pinned at `48801fdcd1009e6ed4863fa9942222a478a297e2`. Read-only Phase 0 established workspace `0b8f55a0-f110-4504-8e16-c9b6c79c5726`, Instagram @dirtyhanddesigns and Facebook Dirty Hand Designs connection metadata. These are earlier read observations, not new live publication evidence.

Sources: [hosted API documentation](https://studio.brightbean.xyz/api/v1/docs), [pinned official source](https://github.com/brightbeanxyz/brightbean-studio/tree/48801fdcd1009e6ed4863fa9942222a478a297e2), [official REST reference](https://github.com/brightbeanxyz/brightbean-studio-agent/blob/main/reference/rest-api.md). Hosted contracts take precedence over conflicting reference claims; pinned source is not proof of the exact hosted deployment version.

Used endpoints: GET `/me/`, `/accounts/`, `/media/`, `/media/{id}`, `/posts/{id}`, `/analytics/posts/{id}`; POST multipart `/media/`; POST JSON `/posts/` with one social_account_id, caption, first_comment, ordered media_asset_ids, action=schedule, scheduled_at and idempotency_key; POST `/posts/{id}/cancel`. No invented GET post collection: GET `/posts/` returned 405 in Phase 0. Account analytics GET `/analytics/accounts/{id}` exists but is not a new account-analytics dashboard here.

Provider PATCH and schedule-existing routes are documented capabilities, but FollOps deliberately reschedules by verified cancellation followed by a newly reviewed revision and fresh deterministic creation. It does not mutate an old mutable Studio draft and assume approval still applies. No auto-publish retry or provider approval endpoint is invented.

Phase 0 observed permissions including create_posts, publish_directly, upload_media, manage_media, edit_media, view_analytics, approve_posts and inbox permissions. Runtime checks still enforce the permissions needed for each actual operation and account allowlists. Publishing tokens/refresh and actual scheduled delivery have NOT been exercised. Native Studio approval settings remain unchanged.

Limitations: image-first (no video/carousel or generated artwork), manual bounded status verification (no new cron/webhook or automatic failure email), calendar filters/conflicts operate on the displayed page and labels say so, only FollOps-managed posts are listed, brand/campaign lists are bounded. Native analytics show supported tiles only, unknown values remain null, unavailable is not zero. Campaign reporting uses exact database status/link counts, not fabricated revenue. CRM attribution is explicit manual evidence plus UTM links; it is not automatic conversion tracking. Draft saving validates current provider accounts and therefore needs provider availability; local history/read operations do not.

## Configuration and security

- Server only: SUPABASE_PROJECT_URL (or SUPABASE_URL), SUPABASE_ANON_KEY (or existing NEXT_PUBLIC_SUPABASE_ANON_KEY), mandatory modern SUPABASE_SECRET_KEY. New code does not fall back to legacy service-role credentials.
- BRIGHTBEAN_API_KEY: server environment, or existing server-readable app_settings entry. BRIGHTBEAN_API_URL defaults to HTTPS studio.brightbean.xyz/api/v1; no redirects or credential-bearing origins. BRIGHTBEAN_WORKSPACE_ID defaults to the seeded DHD ID and must match provider scope.
- SOCIAL_PUBLISHING_WRITES_ENABLED defaults off. Enable only for explicitly authorized controlled UAT. It gates upload, scheduling and cancellation; local drafts, approvals and read reconciliation do not require it.
- SOCIAL_AI_ENABLED defaults off. OPENAI_API_KEY follows existing FollOps environment/settings configuration; sk-ant keys use the existing Anthropic protocol, otherwise OpenAI. Only entered prompt and brand profile are sent; do not include customer details. Durable per-user quota is twenty requests per 24 hours. AI output stays editable and never approves/publishes.

Input bounds, no-store responses, fresh role checks, membership/account scope, safe error projection, bounded provider responses and timeout handling are implemented. No credentials are in browser bundles or logs. The per-instance request throttle is best-effort, not a distributed rate limit; durable AI quota and publishing invariants are enforced in SQL.

Independent static security review found no remaining blocker in the frozen code, with exact commit confirmation requested after commit. Read-only dependency audit reported thirty findings in the existing production graph, including two critical advisories involving proxy-addr/tar; no advisories were reported for the new exact-pinned image decoders. No unrelated blanket dependency upgrades or credential rotation were attempted. Existing repository credential exposure notes remain a separate remediation item.

## Verification evidence

Baseline: TypeScript passed, 204 tests/13 files passed, production build passed. Implementation: initial full regression passed 236 tests/18 files; final regression passed 244 tests/19 files in 16.47 seconds. Final TypeScript passed and production build passed (2,786 modules, 1,315.65 kB HTML / 349.38 kB gzip, 12.44 seconds). Runtime Node 24.19.0; CI targets Node 22. Focused final tests passed enabled OpenAI/Anthropic contracts, unavailable-versus-zero metrics, actual schedule/upload/cancel handlers, real studio review wiring and SQL safety invariants.

PGlite runs actual PostgreSQL 18.6 locally with synthetic profiles/roles/data. This verifies SQL execution, grants/RLS metadata, function invoker posture, manager denial, revision invalidation, duplicate claims, token fencing, independent outcomes, cancellation and recovery. It is NOT proof of hosted Supabase Auth, PostgREST, RLS or Storage behavior on hosted PostgreSQL 17.6. No hosted migration or production data test was performed.

Synthetic browser harness outside the repository imported the actual UI with local fixtures and blocked external fetches. It verified manager restrictions, composer save/version feedback, Jamaica conversion, month/week/list views and exact approval review. Screenshots in the parent workspace: bb-content-calendar-week-qa.png, bb-composer-qa.png, and bb-approval-review-qa.png captured during final UI verification. These are explicitly synthetic, not production screenshots.

## Controlled UAT, release and rollback

1. PA reviews the complete branch, migration and independent QA/security reports. Do not merge/deploy from this report alone.
2. Use an isolated hosted development project first. Confirm its project ref before applying the additive migration, configure modern secret and test owner/manager accounts securely, and verify hosted Auth/PostgREST role denials and table/RPC grants. Initialize DHD membership and grant only intended test actors. Keep provider writes off.
3. In a reviewed preview, create/edit/save a synthetic draft; verify manager denial, owner self-approval, approval invalidation and two-platform independent outcomes with mocked provider tests. Review image/full caption/time/version. Verify no accidental writes while the gate is off.
4. Obtain explicit owner authorization identifying one real image, exact caption, account(s), Jamaica date/time and allowed publication. Check the current live account connections, permissions, BrightBean plan and native approval policy. Do not alter Studio approval settings. Enable the write gate only in the approved environment.
5. Upload the authorized image once, wait for completed processing, save a time at least two minutes ahead, submit/review/approve the exact revision, then schedule Instagram first (and Facebook separately if expressly authorized). Record local operation ID and provider ID. Repeat-click must not create another provider post.
6. Inspect Studio queue and FollOps known-post status. After the scheduled time verify actual native platform content plus native ID/timestamp; only then mark real delivery UAT passed. Verify failure/uncertain handling through fixtures, not destructive experiments on real posts. Read available analytics without claiming causal revenue.
7. If cancellation is authorized, cancel before publication and verify the known provider child is draft/cancelled. A published post is not recalled by cancellation. Turn the write gate off after the controlled test unless ongoing operation is separately approved.

Rollback: disable SOCIAL_PUBLISHING_WRITES_ENABLED and SOCIAL_AI_ENABLED first. Unmerged work can be abandoned by switching away from this feature branch; preserve its commits for review. If a preview is released later, restore the prior reviewed application commit without dropping additive tables or audit history. Never assume an application rollback cancels BrightBean schedules: inspect and explicitly authorize cancellation of every known queued provider ID. Do not delete operation history or retry uncertain publications as a rollback tactic.

Owner decisions before real UAT: exact first artwork/caption, Instagram-only versus both accounts, Jamaica publication time, permitted AI provider/data use, and the named approver. No production readiness or successful real-world publication is claimed by this build.
