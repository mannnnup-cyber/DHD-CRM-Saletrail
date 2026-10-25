# CONTACT-001A — Principal Architect review response

Catalog/baseline captured: 2026-10-23. Follow-up finalized: 2026-10-24 (America/Bogota). Status: LOCAL CORRECTIONS AND EVIDENCE COMPLETE — independent local QA/security PASS; publication/production release BLOCKED pending explicit decisions. No release approval inferred.

## 1. Exact baseline and evidence reconciliation

Existing worktree: `C:/Users/Administrator/Documents/Codex/2026-10-12/do-you-have-access-to-my/work/contact-001a`.
Branch: `feat/contact-001a-secure-review`. Starting HEAD: `7f543dfb8ad2f0650d0e9eddb80c9185eb6d34df`; starting worktree clean. No restart, reset or replacement checkout. Production/planning bases remain `b3b55c82b31decba8a7bd66bdaa20b086a14d383` / `a2356afec539a7dc78b2304427c1d98c8ad12918`.

`4a95862de83bcddedc850df37997153c539545a2` is the application implementation commit. `7f543df` added only the exact-branch Vercel Git safeguard and pre-release report. The delivery report's initial 344-suite/affected-test evidence and the later full 347-test evidence describe different checkpoints, not contradictory claims. Neither proves hosted behavior.

The inherited 234,482-byte patch at `artifacts/contact-001a-review/CONTACT-001A-review.patch` initially matched HEAD: reverse `git apply --check` passed. SHA256: `2b26f05446520a7898d59dc9f45da39f15269113e7e8b901e576c3b71aa9d918`. That patch must be superseded after these corrections; it is not represented as the final source.

## 2. Findings and disposition

| Classification | Finding | Disposition |
| --- | --- | --- |
| Confirmed defect — fixed locally | Cellular history selects non-existent `direction,duration,started_at,status` columns. Hosted columns are `call_type,duration_seconds,called_at`, with no status column. | Corrected mapping/case handling; unknown direction is explicit. No hosted schema change. |
| Confirmed defect — fixed locally | Identity correction updates by ID after a prior read; a stale editor can overwrite another editor's correction. | Seven original values required (428 without snapshot), stale/CAS-zero writes return409. No global uniqueness or new revision schema. |
| Confirmed defect — fixed locally | UI marks an order linked after rejected HTTP responses. | Successful HTTP and application result required; error is visible and the order remains unlinked in UI. |
| Confirmed defect — fixed locally | Different local phone identifiers can escape contradictory evidence and resolve can reuse a contact based on a shared identifier. | Contradictions/shared/placeholder warnings; matching existing records always require deliberate review, never automatic reuse. |
| Confirmed defect — fixed locally | One optional summary/history failure makes the entire authorized comparison unavailable. | Required identity/auth still fail closed; optional errors/rejections yield null/unavailable, never zero. |
| Verified safe locally | Guessed IDs, role gates, hidden counts, disabled legacy paths and browser identity isolation. | Source review and actual mocked-dispatcher tests; not hosted-role certification. |
| Residual risk | Check-before-insert/cross-record collision checks lack shared database serialization. | Reproduce concurrent creation; do not claim duplicate prevention across workers/providers. No in-memory lock or global unique shared-identifier constraint. |
| Residual risk | Assignment/role can change between privileged statements; read-only comparison and count/page are not a single snapshot. | Document consistency limits and mitigate locally where feasible; atomic all-writer authorization needs a separately approved database design. |
| Blocked | Three owner-context views remain hosted with broad grants and no invoker option. | Prepared correction only; separate backup/application/hosted validation approval required. |
| Blocked | A repository-wide push webhook invokes a master/Production Deploy Hook. | No push, hook/config modification or deployment. |

## 3. Endpoint-by-role contract

Matrix describes supported methods with valid inputs and configured modern server credentials. Unsupported methods/invalid fields may return 400/405/415 before a data operation. Missing modern configuration fails closed with 503. Inactive means an authenticated user whose canonical active-role check fails. Assigned/unassigned reps must also pass exact active legacy UUID/email agreement. All scopes are enforced server-side; UI hiding is not authorization.

| Route/action | Unauthenticated | Inactive | Owner | Manager | Correctly assigned rep | Unassigned/foreign rep |
| --- | --- | --- | --- | --- | --- | --- |
| Contacts list/search/count | 401 | 403 | Business scope | Business scope | Assigned rows/count only | Empty permitted scope; no hidden count |
| Contact detail | 401 | 403 | Business scope | Business scope | Permitted contact only; restricted history | 404 |
| duplicateCandidates/findDuplicates/checkBeforeEnrich | 401 | 403 | Permitted candidates | Permitted candidates | Source and candidates assigned | 404 source; hidden candidates omitted |
| compare | 401 | 403 | Both records required | Both records required | Both records assigned; independent summary restrictions | 404 before summaries |
| getDetectionStatus | 401 | 403 | Explicitly unavailable | Explicitly unavailable | Explicitly unavailable | Explicitly unavailable; no saved/global count |
| editIdentity/update/resolve | 401 | 403 | Validated bounded operation | Validated bounded operation | 403 | 403 |
| addNote | 401 | 403 | Permitted contact | Permitted contact | Assigned contact only | 404 |
| searchOrders/linkOrder | 401 | 403 | Bounded search / conditional link | Same | 403 | 403 |
| mergeContacts/enrichLead/enrichContacts/previewEnrichment/migrate | 401 | 403 | 409 disabled | 409 disabled | 403 | 403 |
| CRM organizations getOrganizations/getMembers | 401 | 403 | Business scope | Business scope | Source and each returned endpoint assigned | 404 source; foreign joined identities omitted |
| CRM organizations linkContact/unlinkContact | 401 | 403 | Both endpoints authorized | Both endpoints authorized | 403 | 403 |
| CRM dashboard/default, team | 401 | 403 | Business summaries | Business summaries | 403 | 403 |
| CRM opportunities GET | 401 | 403 | Business feed | Business feed | Explicit unavailable feed | Explicit unavailable feed |
| CRM opportunities dismiss POST | 401 | 403 | Server-derived actor | Server-derived actor | 403 | 403 |
| WooCommerce configured/test/orders/customers/other GET reads | 401 | 403 | Authorized store scope | Authorized store scope | 403 | 403 |
| WooCommerce syncOrders POST | 401 | 403 | Authorized existing sync contract | Same | 403 | 403 |

OPTIONS is public and returns no customer data. DELETE/merge execution is unavailable. Trusted webhook/provider resolver copies and automation/cron are not converted into browser contact routes; their unchanged legacy security is an explicit residual, not a claim that all CRM endpoints are secure.

### Notes, financial summaries and credentials

Assigned-contact visibility alone is not proof that every legacy free-text note is safe. Legacy NOTE rows may contain earlier merge/channel information and often have unknown authors. Record the final restrictive note contract and its tests below; do not claim text sanitization can establish confidentiality. Owners/managers retain legitimate business history. Contact-level order/revenue aggregates are an existing assigned-record summary distinct from store-wide order contents; retain the distinction and obtain explicit owner policy confirmation before release.

Final restrictive contract: reps receive only NOTE rows on a currently permitted contact with server-asserted canonical actor_id matching themselves, source=contact-note and version=1; raw contact.notes, other authors and unattributed/other-source/other-version history are omitted. UI explains the history restriction instead of implying no notes exist. New NOTE metadata derives actor/role/source/version from the authenticated server context, not the request body. Rep user_id uses the already verified legacy UUID; manager attribution stays in metadata to avoid assuming an unrelated legacy FK. This is provenance, not immutable auditing: other privileged/external writers and legacy public routes remain outside the new contract. Reps may still see previously authored own notes after assignment, while other team notes are intentionally restricted pending owner policy acceptance.

New code requires server-only `SUPABASE_SECRET_KEY`, fresh Auth identity and active canonical profile. Browser code receives only its public client configuration and user bearer token. Final build scan and module-graph evidence are required below; no real secret values are copied into reports.

Final bundle check: two local configuration files inspected privately, one available configured privileged value compared against the final1,310,566-byte browser bundle, zero matches. Secret-key-format scan returned0 and decoded service-role JWT scan returned0. Browser-import inspection found no new server-helper/privileged-key import in the changed profile/comparison callers. This verifies the inspected configuration/build, not unknown credentials or the currently deployed production bundle.

## 4. Duplicate/concurrency evidence

Focused follow-up verification: 184/184 across five files (138 actual-handler, 24 edit validation, nine evidence/matching, ten profile DOM, three comparison DOM); final full-suite results below. Cases include parallel matching creations; stale snapshots and conditional-write races; shared/role/placeholder addresses; distinct international numbers with equal suffixes; contradictory local numbers; missing normalized/raw fallback; scoped count/paging; stale comparison responses; preserved correction drafts; and rejected order-link UI/CAS outcomes. An additional direct offline assertion of matchingEvidence for the exact supplied placeholder none@gmail.com passed: possible category and placeholder warning. None of these operations contacted a provider or changed hosted records.

The simultaneous no-match create characterization test explicitly expects two successful inserts/two IDs after both requests read no match. It confirms the race, not its prevention. Conditional same-row edit tests reject stale values and post-read changes with 409 and preserve the concurrent correction. Different full international phones with the same legacy suffix can be saved with an ownership warning; suffixes alone are weak evidence. Raw fallback handles only the submitted literal, digit-only and plus-digit forms; arbitrary legacy punctuation/country interpretations remain incomplete without a reviewed normalization/backfill strategy. Shared-identifier corrections can still require 409 review; durable distinct-identity decisions/approval are deferred to CONTACT-001B rather than silently implementing an override here.

No automatic merge, delete, relationship transfer, enrichment overwrite, provider-identity inference or globally unique email/phone constraint is introduced. Candidate and comparison results are review evidence, not a durable approval or transfer manifest. Counts/pages may reflect different read moments under concurrent changes.

## 5. Hosted schema and query-cost evidence

The follow-up query manifest was compared programmatically to that fresh catalog: 89 required column references across 16 contact/auth/history/count tables, zero missing. This includes the repaired GSM projection/order column, seven-field conditional update, NOTE JSON metadata/actor field and organization joins. Adjacent CRM inspection added dismissed_opportunities and devices (18 tables total); targeted checks of quotes.valid_until, invoices.contact_id, device phone/user/active fields, profile companion_installed and dismissal rule/source/actor returned zero missing. Column existence does not prove foreign-key join serialization, runtime RLS, latency or production Auth behavior; these remain separate acceptance checks.

Fresh read-only catalog inspection of `vatsonbvjkyzxqrnderr` captured 17 referenced tables, supplemented by devices (18 total), and their actual columns in `docs/CONTACT-001A-HOSTED-SCHEMA-EVIDENCE.json`. It contains metadata only, no customer rows. All 18 exist. `contacts.assigned_to` and `interactions.user_id` reference legacy `users(id)`; both organization FKs reference contacts. Do not insert a canonical manager UUID into a legacy FK without exact mapping. `interactions.metadata` is available for a server-derived canonical actor record.

Initial owner comparison performs approximately 33 database reads: canonical profile, two authorized contact reads, 24 relationship counts, four organization counts and two activity reads, plus one Auth request. Rep identity adds a legacy-user query but restricts multiple channels. List and candidate operations each issue a scoped count and bounded page, plus authentication/source checks. Identity/full-name ILIKE and suffix fallback can scan despite ordinary indexes; pagination is bounded but exact counts are not constant cost. No query-plan latency or production-load claim is made from metadata. Final costs after corrections must be recorded below. A future single approved aggregate RPC/index design needs separate scope and performance evidence; no hosted indexes/RPCs are added here.

Final logical request counts remain approximately 33 database statements plus Auth for owner comparison; rep comparison performs 14 database statements plus Auth (canonical+legacy, two initial contacts, eight permitted counts, two final scope rechecks). The 24 owner relation-count jobs share a request-local concurrency limit of four; subsequent organization/activity reads are separate, so this is not a four-statement global database limit. List is three DB reads plus Auth (rep four); candidate review is four plus Auth (rep five); profile is five plus Auth for either role under the current branch. These are code-path counts, not measured hosted latency, CPU cost or query plans. Exact count/page reads may drift under concurrent writes. Optional errors and rejected promises yield null/unavailable status; required identity/authorization/candidate enumeration still fails closed. Generic legacy update retains last-write-wins for its allowlisted nonidentity fields: conditional protection is specifically the seven-field editIdentity path, not every CRM writer.

## 6. Three-view security migration and recovery

Exact file: `supabase/migrations/20261023205637_contact_review_view_security.sql`; SHA256 `7d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7`. Unchanged and UNAPPLIED.

Hosted metadata: all three views are postgres-owned, options NULL, with broad grants for anon/authenticated/service_role/evolution_user. Both base tables have RLS enabled, FORCE false and no policies. postgres and service_role bypass RLS; evolution_user/anon/authenticated do not. Migration history version count is zero. Grants are not proof of row authorization.

`enrichment_status` depends on contacts and exposes identity/enrichment metadata for enriched contacts. `org_members_all` joins contacts twice with contact_organizations and includes ended memberships; `org_members_current` uses the same dependencies with ended_at IS NULL. Setting security_invoker changes permissions/RLS evaluation to the caller, preserving definitions/columns/dependencies/grants. With current base policies, browser roles and evolution_user are expected to see no rows; service-authorized base-table reads retain existing bypass. No named-view consumer was found in current api/src; SQL declarations are the migration's three statements. External consumers, including evolution_user usage, require owner reconciliation before approval.

Catalog `md5(pg_get_viewdef(oid,true))` fingerprints (change detection, not cryptographic backup): enrichment_status `9da06d0535d3179288ca111000cd206c`; org_members_all `ed6246fb3ce7e8e4f1468c0f3cfe753b`; org_members_current `8f9c13e17ce9d241619cabbd487ab53b`. No additional dependent views were found by pg_depend/pg_rewrite inspection. Plain email and normalized-phone indexes are nonunique; no shared-identifier uniqueness guarantee exists. Current source does not query the named views; integration role consumers outside this repository remain unknown.

Catalog definitions, whitespace condensed only (not replacement DDL):

```sql
-- enrichment_status
SELECT id,name,email,company,enrichment_source,enrichment_confidence,
       enrichment_timestamp,enrichment_notes,
       CASE WHEN enrichment_source IS NULL THEN 'NOT_ENRICHED'::text
            WHEN enrichment_confidence >= 0.9::double precision THEN 'HIGH_CONFIDENCE'::text
            WHEN enrichment_confidence >= 0.7::double precision THEN 'MEDIUM_CONFIDENCE'::text
            ELSE 'LOW_CONFIDENCE'::text END AS enrichment_quality
FROM contacts WHERE enrichment_source IS NOT NULL
ORDER BY enrichment_timestamp DESC;
-- org_members_all
SELECT c.id AS member_id,c.name AS member_name,c.email AS member_email,
       c.phone AS member_phone,c.role,co.started_at,co.ended_at,
       CASE WHEN co.ended_at IS NULL THEN 'ACTIVE'::text ELSE 'ENDED'::text END AS status,
       co.is_primary,co.organization_id,org.name AS organization_name
FROM contacts c JOIN contact_organizations co ON c.id=co.contact_id
JOIN contacts org ON co.organization_id=org.id ORDER BY org.name,co.started_at DESC;
-- org_members_current
SELECT c.id AS member_id,c.name AS member_name,c.email AS member_email,
       c.phone AS member_phone,c.role,co.started_at,co.ended_at,
       co.is_primary,co.organization_id,org.name AS organization_name
FROM contacts c JOIN contact_organizations co ON c.id=co.contact_id
JOIN contacts org ON co.organization_id=org.id WHERE co.ended_at IS NULL
ORDER BY co.started_at DESC;
```

The existing view role column comes from c.role, whereas the authorized organization server response uses the membership co.role. The prepared migration preserves that existing semantic difference; it does not change definitions. Recorded ACLs grant arwdDxtm to postgres, anon, authenticated, service_role and evolution_user on these views and their two base tables. The migration neither grants nor revokes these privileges; invoker/RLS changes the effective data access. Review any external write/view consumer separately.

Additional read-only information_schema.views inspection marks enrichment_status updatable and insertable, with no INSTEAD OF triggers; both organization views are non-updatable/non-insertable. Combined with its broad grants and owner context, the enrichment view presents a potential write exposure as well as read exposure. No hosted mutation, HTTP exploit or affected-row test was attempted, so this is catalog-supported potential exposure, not a demonstrated customer-data write. The separately approved synthetic hosted validation must cover denied browser writes as well as reads after invoker application.

Separately executable preflight, backup/restore, exact-file application, synthetic hosted validation, rollback and stop conditions are in `docs/CONTACT-001A-VIEW-MIGRATION-VALIDATION-PLAN.md`. It requires a verified full accessible-CRM backup and actual private local restore before hosted application; it does not require a paid Supabase plan. Storage object bytes/platform settings require separate coverage. No actual hosted CRM backup or hosted restore was performed in this follow-up.

The recovery method was exercised on the existing disposable local PostgreSQL17.10 synthetic cluster. The source public schema contained only synthetic_contacts and the three synthetic views. A custom-format pg_dump produced 4,658 bytes; pg_restore --list returned 27 lines; restore with --exit-on-error into a newly created local database passed. Restored row count was one, all three options were NULL, and anon saw one synthetic row. Exact-file migration application then produced anon0/service_role1. Targeted RESET rollback restored three NULL options and retained one row. The server was stopped. Backup: `C:/Users/Administrator/.codex/private/follops-db-validation/contact-001a-recovery-20261023/synthetic.dump`; SHA256 `1245c8a0a44d8b0c301f7bb4de0e36f1e173820ec3defc699694fd0d0ef76e82`. This proves the method on synthetic data only, not recoverability of the hosted CRM. No hosted credential, dump or customer row was accessed by this test.

## 7. Deployment control

Read-only GitHub inspection reconfirmed active webhook641005278 on `push`, targeting the FollOps project's Deploy Hook. Prior delivery detail proved master and feature-branch pushes received 201/PENDING jobs. Vercel UI identified the exact matching hook as GitHub CI targeting master; Production settings track master and auto-assign domains. The URL was matched privately, not repeated in this report. Exact project: dhd-crm-saletrail, prj_USKJsJQAVoYMosqbE19F6bre2nhK, team_oR9AcZvAU91AR7ralAlffIB3.

The feature-only deploymentEnabled=false rule is unchanged. It is not a verified lock on a separate master-target hook. No safe existing-repository push path is verified; publication remains BLOCKED. Current task forbids hook/Vercel changes and push. Retain a new local patch. An isolated private review repository without deployment integration is a proposed future alternative requiring separate authorization and verification, not an action performed here. No GitHub/Vercel settings, migration or customer data changed.

## 8. Final independent verification and changes

| Change | File references |
| --- | --- |
| Original-value validation, collision review, conditional identity update | src/lib/contacts/edit-server.ts:29; src/lib/contacts/edit-server.test.ts |
| Resolver non-reuse, NOTE attribution/scope, actual cellular columns, optional profile history | src/lib/contacts/api-server.ts:7; tests/contact-security.test.ts |
| Bounded phone candidates, explicit unavailable counts/activity, relation fanout and final rep rechecks | src/lib/contacts/review-server.ts:3; tests/contact-security.test.ts |
| Contradictory phone/shared/placeholder evidence | src/lib/contacts/review.ts; src/lib/contacts/review.test.ts |
| Response-pair identity/key/abort guards and unavailable UI | src/components/ContactCompare.tsx:5; src/components/ContactCompare.test.tsx |
| Original snapshot/draft preservation, visible partial history/order-link errors | src/pages/ContactProfile.tsx:147,182,204,1022,1053; src/pages/ContactProfile.test.tsx |
| Read-only catalog, migration/recovery plan and checkpoint reconciliation | docs/CONTACT-001A-HOSTED-SCHEMA-EVIDENCE.json; docs/CONTACT-001A-VIEW-MIGRATION-VALIDATION-PLAN.md; delivery/pre-release/context/work-packet follow-up notes |

- Sole implementation owner reported184/184 focused tests passed (five files,86.61s).
- Independent QA ran the complete stable source: **460/460 tests,25 files,99.04s**, using npm test -- --testTimeout=15000. Independent TypeScript check passed (tsc --noEmit,exit0). Independent production build passed:2,784 modules,1m24s,index1,310.57kB/gzip348.59kB,exit0. Final whitespace/diff checks passed.
- A prior focused attempt hit a default five-second component-start timeout under slow Windows execution (97/98), not an assertion failure; the complete final run used an explicit15-second test timeout. This is a test-run option, not a production/deployment configuration change.
- Independent security source review **PASS**: strict actor/source/version note filters and negative fixtures, server-derived attribution, seven-field edit CAS, no automatic reuse, scoped comparison and partial-history behavior. Reviewer inspected source/coverage and did not claim hosted verification.
- Role coverage:33 protected action tuples each tested missing-token/inactive denial (66 cases), nine privileged rep-write denials, owner/manager legitimate contact workflows, and earlier assigned/foreign/source+comparison/note/order cases. The matrix is the source-enforced contract; not every cell was executed through hosted Auth/PostgREST, and no WooCommerce provider test/sync was invoked. Existing Inbox/list/profile DOM and integration contract regressions are included in the full suite.
- No earlier PASS is carried forward over untested app changes. Only documentation changes follow the tested source freeze. API CRM/WooCommerce dispatch, provider handlers/settings, deployment configuration and migration bytes remain unchanged from7f543df.

## 9. Release decision gates

- Independent final QA/security and targeted concurrency/privacy tests must pass.
- Atomic cross-worker/cross-provider duplicate creation and assignment authorization consistency require explicit residual-risk decisions; no database safety guarantee is claimed.
- Rep notes and assigned-contact financial-summary policy needs explicit acceptance of the final restricted contract.
- Hosted view consumer/backup/recovery/application validation remains separately authorized and unapplied.
- Hosted synthetic Auth/PostgREST/browser acceptance remains unverified; local mocks/native SQL do not replace it.
- GitHub publication is blocked by the separate production Deploy Hook, and production release remains unapproved.

## 10. Commit and patch handoff

Application correction/test commit: **84bcbfbd09381706217f8929751d222ceb815685** on the existing feat/contact-001a-secure-review branch. This is the exact application delta that passed final local QA. The subsequent documentation commit contains this response, schema evidence, recovery plan and historical checkpoint/context references; its final SHA is reported in the handoff message and Git history.

Regenerated review patch: `C:/Users/Administrator/Documents/Codex/2026-10-12/do-you-have-access-to-my/artifacts/contact-001a-review/CONTACT-001A-architect-review.patch`, against base b3b55c82b31decba8a7bd66bdaa20b086a14d383. It supersedes the inherited patch and includes planning, implementation, safeguards, corrections and final documentation. The lead generates it only after the documentation commit and checks reverse applicability against the final checkout. Patch size/hash/check result are reported with the handoff. No remote commit/report URL exists for this local-only handoff. No push, merge, deployment or hosted migration has been performed.
