# CONTACT-001 — Duplicate Contact Management Plan

Assessment date: 2026-10-23 (America/Bogota)

Status: Assessment/design only — implementation and hosted changes require Principal Architect approval.

Repository: mannnnup-cyber/DHD-CRM-Saletrail

Verified origin/master baseline: b3b55c82b31decba8a7bd66bdaa20b086a14d383

Planning branch: docs/contact-001-duplicate-management

Hosted project inspected: vatsonbvjkyzxqrnderr, PostgreSQL 17.6, ACTIVE_HEALTHY.

## 1. Executive finding and evidence boundaries

[Certain — VERIFIED CODE] The existing “merge” copies selected fields/enrichment into a primary contact but does not transfer history, retire the secondary, or create a canonical redirect. Legacy contact read/detection/merge routes lack the authentication used by the newer correction endpoint. A comparison modal on top of those routes would retain an authorization bypass.

[Certain — VERIFIED HOSTED] There are 592 active contacts. Six case-folded email groups contain 13 contacts; five stored-normalized-phone groups contain ten contacts. Groups may overlap. These are candidate matches, not confirmed duplicate people.

[Likely — RECOMMENDATION] Deliver authorized conflict review first, then durable decisions/canonical identity support, then an approved transactional merge. No automatic merging is proposed.

Evidence labels:

- VERIFIED CODE: inspected at the baseline above; implementation is not proof of hosted execution.
- VERIFIED HOSTED: project metadata, catalog, aggregate queries and anonymous SQL-role count checks.
- VERIFIED LOCAL: synthetic tests/offline helper checks, not hosted mutation evidence.
- PROPOSED: future behavior requiring approval.
- UNKNOWN / BLOCKED: unverified behavior or a prerequisite preventing safe execution.

No production code, hosted rows/schema/grants, account connections, provider settings or credentials were changed. No merge, deletion, messaging/store/social-provider call, email sync, publishing or deployment was exercised. Relationship/security checks used read-only transactions; the initial metadata SELECT was also non-mutating. Separate query snapshots are observations, not a frozen backup.

Recent merges checked: PR #20/cceaca3 added scoped corrections; PR #21/b3b55c8 repaired partial email-sync feedback. Worktrees were inventoried. The paused BrightBean branch has a proposed social_attributions contact FK, but older contact files; replacing current files from that branch would regress corrections. Its migration remains outside CONTACT-001.

## 2. Current functionality versus missing functionality

| Area | Current finding | Missing / implication |
| --- | --- | --- |
| List/profile | VERIFIED CODE: list, local search/filter, profile/history; server requests range 0–4999. | No complete server-paginated, permission-scoped duplicate queue. Loaded length is not a reliable total. Actual hosted response cap was not measured. |
| Corrections | VERIFIED CODE: editIdentity verifies fresh Auth + active owner/manager, uses modern secret only, validates/persists fields and shows failures. | Generic 409 lacks matched field, permitted candidates/count and review actions. Rep identity corrections are denied today. |
| Creation/resolution | VERIFIED CODE: POST resolve creates or takes first email OR phone match; several integrations duplicate that resolver. | No canonical shared resolver, ambiguity rejection, merged-ID handling or atomic check/create guarantee. No dedicated ordinary manual contact-create form found. |
| Matching | VERIFIED CODE: exact normalized identifiers plus Levenshtein name/company score. | Score is not a calibrated probability; supporting evidence can lower it and conflicting identifiers do not reduce it. |
| Enrichment warning | VERIFIED CODE: checkBeforeEnrich searches previously enriched contacts. | UI calls missing /api/duplicates; real action is under /api/contacts. Ordinary candidates excluded; self/duplicate results possible; confidence DTO mismatch. |
| “Merge & Enrich” | VERIFIED CODE: selected field copy plus attempted detection/note inserts. | No field-conflict approval, relationship transfer, archive/redirect, transaction, revision check, idempotency or reliable audit. |
| Detection history | VERIFIED HOSTED: ordered UUID-pair check, nonunique pair index; zero detections observed. | No durable distinct/reject decision, actor/approver, evidence revisions, operation or reversal ledger. |
| Deletion | VERIFIED CODE: no ordinary contact-delete endpoint/UI found. Local deleteLead is different. | Hard deletion must not implement a merge. |
| External updates | VERIFIED CODE: contact fields coexist with provider/order snapshots. | CRM corrections do not update WhatsApp profiles, Gmail address book, WooCommerce accounts or historical headers. |
| Staff workflow | VERIFIED CODE: scoped email reads require verified assignment; new contact corrections and personal WhatsApp controls are owner/manager-only. | No safe general rep comparison/proposal policy yet. Public legacy routes are defects, not intended rep permissions. |

### Source evidence

- Contact list/detail/resolve/update/dispatch: [api/contacts.ts](../api/contacts.ts#L47-L124).
- Correction validation/auth/conflict: [edit-server.ts](../src/lib/contacts/edit-server.ts#L5-L65).
- Duplicate score/scanning: [api/contacts.ts](../api/contacts.ts#L242-L345).
- Enrichment checking and incomplete merge: [api/contacts.ts](../api/contacts.ts#L349-L440).
- Missing enrichment endpoint and merge invocation: [ContactProfile.tsx](../src/pages/ContactProfile.tsx#L196), [legacy merge call](../src/pages/ContactProfile.tsx#L327).
- Detection schema: [phase-0-org-enrichment.sql](../supabase/phase-0-org-enrichment.sql#L104-L120).
- Canonical/legacy staff agreement and email ownership: [email-server.ts](../src/lib/inbox/email-server.ts#L19-L27), [visibility join](../src/lib/inbox/email-server.ts#L54-L63).

[Certain — VERIFIED LOCAL] Offline existing-helper evaluation with synthetic values returned identical-name-only 0.7, identical-name-plus-company 0.5, and identical name with conflicting email/phone 0.7. The 0.6 threshold excludes some stronger supporting evidence and accepts contradictory candidates. The merge writes fixed 0.95 manual confidence, not verified identity evidence.

Other confirmed defects: same-contact/arbitrary-strategy merges are not rejected; a stale entire primary row is spread into the update; copied phone can leave phone_normalized stale; detection/note failures are nonfatal. A success toast proves neither consolidation nor durable audit. Resolver filter interpolation needs escaped/bound exact matching.

## 3. Actual database relationship map

### 3.1 Hosted contact and security facts

[Certain — VERIFIED HOSTED]

- contacts.id is UUID primary key; email and phone_normalized indexes are NONUNIQUE.
- contacts.assigned_to references legacy users.id, not user_profiles.
- is_active, organization_id, sources/tags, enrichment fields and order aggregates exist. No merged_into, merge operation, authoritative revision or merge lifecycle exists.
- All 592 contacts observed were active. duplicate_detections and contact_organizations were empty.
- There are **20 foreign keys referencing contacts across 17 tables**, including its organization self-reference.
- whatsapp_calls.contact_id is an additional UUID soft link WITHOUT a foreign key; no current orphan was observed.
- No public merge/resolve/duplicate/audit SQL function was found by those names.
- No contact UPDATE trigger exists; updated_at is not an authoritative version across all writers.
- contacts/duplicate_detections/contact_organizations have RLS enabled and no policies. anon/authenticated retain broad grants; normal row operations are constrained by RLS, but privileged server clients bypass it.
- enrichment_status, org_members_all and org_members_current have owner-context defaults (no security_invoker option) and anon/authenticated grants. In a read-only SET LOCAL ROLE anon check, contacts returned zero rows while enrichment_status returned **one row**. This is verified SQL-role visibility bypass. HTTP/Data API exposure was NOT tested; no customer field values were retrieved.
- No pg_trgm extension is installed; initial deterministic matching need not add it.

### 3.2 Foreign keys and preservation

Delete effects explain the danger of deletion; they do not authorize it.

| Relationship | Delete effect today | Proposed preservation |
| --- | --- | --- |
| calls.contact_id, cellular_calls.contact_id | SET NULL | Move verified CRM FK; retain call IDs, phone, rep, timestamps and historical name snapshots. |
| leads.contact_id, deals.contact_id | SET NULL | Move CRM FK; preserve independent lead/deal IDs and links. |
| tasks.contact_id | SET NULL | Preserve task ID, due/completion state and assigned user; review assignment separately. |
| quotes.contact_id, invoices.contact_id | SET NULL | Preserve document IDs/numbers, accounting/customer snapshots and lead/deal/quote chains. |
| emails.contact_id | SET NULL | Preserve email UUID/message_id/thread_id, headers/body/date/read; preview rep visibility changes. |
| whatsapp_messages.contact_id | SET NULL | Preserve message UUID, exact chat_id, provider_message_id/provider/instance evidence and raw_data. |
| woo_orders.contact_id | SET NULL | Preserve order ID/woo_order_id and monetary/customer snapshots; next sync must not undo association. |
| contacts.organization_id | SET NULL | Inspect incoming parent references; reject self-parenting/cycles. |
| contact_organizations.contact_id AND organization_id | CASCADE | Handle both endpoints, self-membership and duplicate periods; explicit resolution, no silent row loss. |
| interactions.contact_id | CASCADE | Transfer FK, retaining notes, message references and historical content. |
| lead_stages.contact_id, order_trends.contact_id | CASCADE | Preserve stage history; recompute derived trends from distinct orders rather than summing duplicate aggregates. |
| dismissed_opportunities.contact_id | CASCADE | Preserve user/rule/source decisions; resolve collisions explicitly. |
| duplicate_detections.contact_a_id / contact_b_id; merged_into_id | CASCADE / SET NULL | Preserve original pair evidence; never repoint into an invalid equal-ID pair. New audit must survive lifecycle. |
| whatsapp_calls.contact_id (NO FK) | None enforced | Explicitly include/guard this soft link; FK discovery alone is incomplete. |

### 3.3 Other stores and stable identifiers

- WhatsApp chats are keyed by exact chat_id; status and profile-backed assignment are independent of contacts. Phone labels belong to provider chats. Personal receipts key actor/message UUID. Contact merges must not change JIDs, label membership, message IDs, phone read receipts or chat assignment.
- activities has metadata but no contact_id column. Preserve legacy IDs; handle known metadata references explicitly, never global JSON/text replacement.
- DataContext caches CRM state in localStorage. rowToLead drops hosted contact_id; rowToDeal prefers lead_id. Some frontend contactId values therefore mean lead IDs. Current DataContext quote/invoice UI mutation paths are local-only, although hosted tables and unused helpers exist. Empty hosted tables do not prove absence of browser business drafts.
- woocommerce_sync is a separate snapshot store without contact_id. woocommerce-webhook.ts targets woocommerce_orders, absent from this hosted schema; that path is not verified working.
- woo_orders lacks a dedicated stored external customer ID/store-scope field. Future scoped mappings require evidence, not name/email inference; preserve existing order IDs.
- BrightBean social_attributions.contact_id exists only in the paused feature migration. If later applied, add it to the manifest; CONTACT-001 must not apply it.

Key code: [adapters](../src/lib/adapters.ts#L3-L33), [cached/legacy mutations](../src/context/DataContext.tsx#L40-L277), [WhatsApp ingestion](../api/whatsapp.ts#L257-L318), [chat state](../api/whatsapp.ts#L2080-L2105), [Woo sync](../api/woocommerce.ts#L217-L258), [organization links](../api/crm.ts#L330-L376).

### 3.4 Aggregate volume observed

| Store | Rows / non-null contact links |
| --- | --- |
| interactions | 94,039 / 94,039 |
| cellular_calls | 15,373 / 3,315 |
| whatsapp_messages | 10,174 / 4,082 |
| whatsapp_calls | 325 / 38 |
| tasks | 143 / 143 |
| emails | 95 / 43 |
| woo_orders | 46 / 45 |
| calls, leads, deals, quotes, invoices, lead_stages, order_trends | Zero rows in each |
| contact_organizations, dismissed_opportunities, duplicate_detections | Zero rows in each |

Null links are not permission to assign rows through fuzzy matching during merge. Mirrored stores can describe one event: preserve rows and deduplicate presentation only through proven event references.

## 4. Defects, risks and prerequisites

1. **HIGH / VERIFIED CODE:** legacy contact routes bypass fresh authentication/scope. Contain the old merge and related read/detection alternatives before a secure UI.
2. **HIGH / VERIFIED HOSTED:** owner-context views bypass base RLS at SQL-role layer. Review consumers and repair narrowly in a future approved migration; no permissions changed now.
3. **HIGH / VERIFIED CODE:** existing merge cannot preserve relationships/concurrent updates. Replace its contract rather than relabel it as a safe merge.
4. **HIGH / VERIFIED CODE:** reassociating email can grant another rep history through contact assignment. This is a confidentiality decision.
5. **HIGH / VERIFIED CODE/HOSTED:** resolver copies, enrichment, automation, caches and imports can recreate duplicates/revive secondary IDs. Timestamps miss drift.
6. **MEDIUM / VERIFIED CODE:** last-ten-digit phone normalization can collide across countries. Email and phone can match different contacts, yet resolver takes the first OR result.
7. **MEDIUM / VERIFIED CODE:** scoring, missing enrichment route and confidence DTO mismatch produce misleading/missing warnings.
8. **MEDIUM / VERIFIED HOSTED:** pair ordering does not enforce pair uniqueness. Best-effort notes are not atomic audit.
9. **MEDIUM / VERIFIED CODE:** loaded-array search/counts are incomplete beyond requested/provider caps. Filter/count in DB before pagination.
10. **UNKNOWN:** browser draft quality, provider ownership, external customer mappings and reversal eligibility need future validation.

Legacy privileged-key fallback persists in old code. New work uses server-only SUPABASE_SECRET_KEY. This plan does not authorize rotations or broad unrelated API redesign.

## 5. Proposed interface and workflow

All behavior in sections 5–11 is PROPOSED.

### A. Actionable duplicate warnings

Retain the unsaved correction form. A structured 409 provides matched field(s), permitted candidate summaries and reasons. Fictional example: “Email matches 2 contacts you can review.”

Each visible candidate shows name/company, matched badges, allowed identifiers and View / Compare. Visible count is scope-labeled and server-paginated. For inaccessible matches provide only generic manager-review guidance: no hidden UUID/name/company/identifier or global hidden-match count. Authorize before projection/counting. Cancel/navigation/account changes must discard stale responses.

### B. Side-by-side comparison

Show name/company/email/phone; source/creation date and provenance; matching versus conflicting values; recent activity; leads/deals/tasks; email/WhatsApp CRM links; orders/quotes/invoices and transfer counts. Distinguish unknown from empty/mismatched.

Load bounded history sections on demand. Contact access does not imply every channel's content access: use existing channel policies and deny restricted history. Both candidate UUIDs are authorized afresh.

### C. Suggested merge and explicit review

Use reasoned categories, not misleading probabilities: Likely duplicate / Possible shared identifier / Conflicting evidence / Needs verification.

Suggest primary by active stable verified identity, authoritative links and ownership; age/completeness are tie-breakers, never proof. Manager can choose another primary after reviewing consequences. Block individual-versus-organization merges initially.

Preselect equal verified values; conflicts require explicit field choices and source evidence. Empty values must not overwrite verified ones. Retain nonselected historical values in restricted audit; only separately verified legitimate identifiers become active future aliases. A corrected typo must not become a routing alias.

Suggestion includes primary/secondary UUIDs, reasons, field selections, assignment choice, relationship/access manifest and revision/evidence fingerprint. Compare, Suggest, Approve and enrichment never execute a merge. Execute is a separate owner/manager action.

### D. Durable Not duplicates

Store sorted pair, actor/reason/time, material identifier fingerprints and rule version. Suppress that pair/evidence only. Identity/type/external-ownership changes invalidate it; unrelated notes need not.

A distinct decision is not blanket identifier reuse permission. A manager-reviewed shared-email/phone policy may allow the current reviewed pair while still rejecting new unreviewed collisions. Do not add global unique contact email/phone constraints.

Recommend staff suggest distinct, owner/manager confirm business-wide. Personal staff dismissals, if adopted, cannot hide candidates from managers.

### E. Contact corrections

Retain current owner/manager identity-edit scope first. Assigned-rep correction needs an explicit approved permission and exact canonical/legacy identity + assignment verification; public legacy access is not a permission.

Correction affects the selected CRM record only. It never silently changes another contact, provider identity, historical email headers or accounting snapshots. Enrichment must not overwrite a reviewed correction without another field decision/audit.

## 6. Proposed matching and confidence rules

| Signal | Interpretation |
| --- | --- |
| Trimmed/case-folded exact email | Strong candidate, not proof of person; support reviewed shared mailboxes. Preserve plus/dot distinctions. |
| Verified full international phone | Strong candidate with provenance/country context; original display value retained. |
| Legacy last-ten digits | Possible match requiring verification; never sole approval evidence or inferred PN/LID equivalence. |
| Same name/company | Weak discovery hint, never sufficient merge authority. |
| Scoped external ID | Evidence for that provider/store/account only; immutable. Conflicting ownership blocks initial execution. |
| Conflicting verified identifiers | Adverse evidence, not ignored; review or hard block. |
| Missing/malformed values | Unknown, not equal or proof of no duplicate. |

Do not default every number to Jamaica; collect/verify ambiguous country context. Version normalization and migrate compatibility separately. Use indexed bounded discovery, not whole-table application scans/O(n²) batches. Initial exact discovery needs neither AI nor pg_trgm; optional fuzzy search follows evaluated fixtures/query plans.

Retired contact-ID redirects, historical field evidence and active identifier aliases are different. Preserve record UUIDs permanently; do not activate every discarded value for future matching.

## 7. Proposed permission and audit requirements

| Operation | Sales staff | Owner / manager |
| --- | --- | --- |
| View/search/compare | Verified permitted contacts and independently permitted history only | Business scope, fresh active identity |
| Ordinary identity correction | Current endpoint denies; assigned-only expansion needs owner decision | Current validated flow |
| Submit merge/distinct suggestion | Both records permitted; otherwise generic manager-review request without hidden details | Allowed |
| Confirm global distinct decision | Not initially | Allowed with reason/fingerprint |
| Resolve assignment/conflicts, approve/reject | No | Explicit, current evidence |
| Execute / reverse | No | Separate authorized actions |

Verify fresh Supabase Auth and active canonical user_profiles. Rep mapping must agree with legacy users UUID/email where that ownership contract applies; no staff UUID mapping by name/email alone.

Conflicting contact owners default BLOCKED until owner/manager chooses assignment and reviews access gained/lost. Child task/deal ownership and WhatsApp chat assignment do not automatically follow primary. Even same-owner reassociation requires history-access review.

Audit atomically with state changes: proposer/approver/executor and roles, reason, operation key, record IDs, selected field provenance, before/after revisions, exact child IDs/links, access-impact digest, outcome and reversal reference. A best-effort NOTE is not audit. Restricted before/after PII belongs in protected DB audit, never Git, application logs, reports or browser persistence.

Owner decision: recommend distinct proposer/approver where staffing permits. Sole-owner self-review, if adopted, must be explicit, recorded and separated from Execute; never auto-approval.

## 8. Preservation, concurrency and rollback design

### Canonical lifecycle

Keep secondary UUID/row inactive and merged, with merged_into_contact_id and merge operation reference. Old contact URLs resolve only after authorizing source and destination; do not reveal private redirect destinations or issue an unscoped cacheable permanent HTTP redirect.

Reject self-merge, cycles, invalid/already-merged targets and opposite-direction races. Later chain resolution is bounded; original redirect/audit evidence remains. Distinguish manually inactive from merged.

### Transaction outline (design, not executable SQL)

1. Authenticate executor and validate original request IDs/payload fingerprint. Authorize access to an existing operation key before disclosing any result. An authorized completed same-key/same-payload operation returns its recorded outcome BEFORE pre-execution revision/unmerged-state checks; successful execution changed those values. Changed payload conflicts, and current permission is still required to read the result.
2. Begin one short PostgreSQL transaction and claim/lock the unique request key. Recheck completion to handle a racing request; return its authorized result if already committed. Otherwise resolve current record state, acquire per-contact transaction locks in consistent UUID order and lock both parent rows.
3. For a genuinely new execution, recheck active role, scope, authoritative revisions, approval, field/assignment choices, identity evidence and current child/access manifest. Drift means stale/review required.
4. Bind the operation to its immutable payload/proposal. Different keys for the pair cannot apply twice: contact lifecycle/pair checks inside the same ordered locks reject already-merged or opposite-direction requests.
5. Transfer each enumerated verified CRM relationship while preserving child UUIDs/provider keys/content. Resolve hierarchy/organization/uniqueness conflicts explicitly. Update only selected contact fields.
6. Recompute derived order totals/trends from distinct preserved source orders, not summed duplicate aggregates. Do not rewrite accounting snapshots or historical detection pairs.
7. Archive/redirect secondary, bump authoritative revisions and write exact before/after relation manifest/audit in the same transaction. Any failure rolls back everything.
8. Commit and refresh scoped UI caches. No provider/HTTP/AI call inside the transaction. Lost response means reconcile the same operation key; never blindly retry under a new key.

**Locking limits:** parent locks alone do not cover unguarded soft links, stale clients, independent writers or future references to archived rows. FK-backed writes can contend on parent locks, but every writer must resolve canonical IDs and participate in appropriate transaction/DB guards. Recompute protected child state; reject stale manifests. An unaccounted writer/reference blocks enablement.

Benchmark high-volume contacts with short lock/statement timeouts in local/staging tests. Do not split a merge into non-atomic chunks without a separate reviewed design. Most contact FKs have leading-column indexes; duplicate_detections.contact_b_id and merged_into_id do not, and need review when audit/history grows.

### Writer/read compatibility required before execution

- contacts.resolve/update/migrate, editIdentity, enrichment and conflict checking.
- WhatsApp ingestion/resolution/manual associations; exact chat/receipt/label paths remain unchanged.
- IMAP lookup-only import, email conversion to lead, and message/contact visibility joins.
- Woo resolver/order upsert/manual association: subsequent sync must preserve canonical association.
- Automation direct unknown-phone/WhatsApp inserts, currently bypassing a common resolver.
- Organization type/parent/membership changes and user deactivation/assignment cleanup.
- DataContext/adapters/browser drafts: never delete unsynced quotes/invoices as cache invalidation. Reconcile legacy lead IDs explicitly.
- Every newly approved future schema, including BrightBean attributions, triggers a fresh relationship audit.

### Reversal versus migration rollback

A future hosted migration needs a recoverable relevant backup, restore evidence and rollback plan. Backup availability was NOT revalidated in this assessment.

Business reversal is a new approved compensating operation, not deleting audit or restoring the entire CRM. Use exact child UUIDs and original before/after links; preserve subsequent messages/orders. Refuse automatic reversal if rows, ownership, aliases, dependent merges or other relationships changed. Unsafe cases require owner-managed repair. Do not advertise universal Undo before these tests pass.

## 9. Proposed migration requirements and API contracts

No migration was created/applied. Object names are proposals.

| Proposed object | Requirements |
| --- | --- |
| Contact lifecycle/revision fields | merged_into_contact_id, merge_operation_id, merged_at/by, monotonic revision. Check self-reference/lifecycle; DB-maintain version across every writer. Reuse is_active without conflating manual inactivity. |
| contact_duplicate_decisions | Unique sorted pair; decision, actor/reason, material evidence fingerprints/rule version. |
| contact_merge_proposals | Proposer, chosen records/fields/assignment, revisions, relation/access digest, submission/review/stale state. |
| contact_merge_operations | Unique request identity/payload hash, proposal/outcome/reversal link; serialized effect and uncertain-response reconciliation. |
| contact_merge_audit / relation manifest | Atomic append-only events and exact moved row evidence, protected retention/access. |
| Typed identifier / external binding records | Additive verified aliases/provider-store identities where evidence exists; shared email/phone not globally unique; discarded invalid fields not active aliases. |
| Server-authorized transaction RPC(s) | Security invoker preferred; explicit schema/search_path and EXECUTE revocations. Modern-secret server path only; no public/browser merge RPC. |
| Narrow contact-view/grant/index repairs | Separate approved security migration with consumer impact checks. No implied broad RLS/grant redesign or extension activation. |

Proposed HTTP actions under the contacts API: duplicateCandidates, compare, suggestMerge, reviewMerge, executeMerge, mergeOperationStatus, markDistinct, resolveCanonical. These are NOT current endpoints; final names/DTOs need PA review.

Read actions are bounded no-store GETs with explicit projection. Decisions/approval/execution use authenticated mutation methods, bounded input, UUID validation and origin/CSRF controls appropriate to bearer-token auth. Status lookup authorizes the operation; no arbitrary audit dump.

Conflict DTO: stable error code, matched fields, visible candidate summaries/count/cursor, generic restricted-match flag; no hidden totals. All lookup/counts apply visibility first.

RLS and explicit least-privilege grants are required for new tables. Revoke default PUBLIC/anon/authenticated RPC execution. A service RPC must not trust arbitrary caller-supplied actor/role: only a verified server path invokes it, with current active permission rechecked from DB state. New code cannot use legacy privileged fallback.

## 10. Test plan and evidence

### Already verified in this assessment

27 existing contact tests passed: 24 server and three ContactProfile DOM. QA ran installed sibling-worktree tests after SHA256 equality of both production files and both test files with this baseline. These verify current corrections/auth/input/collision/persistence/errors/navigation, not hosted merging. No tests or production files were added/changed. No fresh build/full suite was run for this documentation-only task.

### Required future tests

1. Matching: shared email, plus/dot distinction, wildcard escaping, international/suffix ambiguity, self-exclusion, candidate deduplication, supporting/conflicting evidence and deterministic reasons.
2. Visibility: unauth/inactive/rep/manager/owner, canonical/legacy mismatch, guessed IDs, hidden counts and separate channel-content scope.
3. Grants/views/RPC: actual anon/authenticated roles and HTTP Data API with synthetic fixtures/aggregate evidence; no owner-context view bypass; owner/manager workflows preserved.
4. Corrections: preserve form on 409; permitted links/compare; restricted matches; reviewed shared identifiers; stale responses ignored; no silent other-contact update.
5. Decisions: pair uniqueness, distinct fingerprint invalidation, unauthorized dismissals and staff suggestions without leaking candidates.
6. Approval: role downgrade, changes to contact/relation/identity/assignment evidence and field choices invalidate prior approval, including enrichment/new inbound relationships.
7. SQL preservation: all 20 FK references plus soft links; organization endpoints/self-links; unlinked histories; accounting values; provider IDs; audit rollback and historical detection-pair integrity.
8. Concurrency/idempotency: double click, opposite-order and overlapping three-contact merges, same/different request keys, stale writers and incoming order/message inserts. One effect; lost response reconciles.
9. Access regression: rep email visibility before/after, chat assignment independence, cross-owner history resolution explicit.
10. Canonical ingestion: re-import old order/message, stale contact URL/ID, browser draft, automation/enrichment and soft-link writes cannot recreate/revive/overwrite retired contacts.
11. Reversal: preserve all IDs/history for eligible quiet merge; refuse after later edits/dependencies/merges; never delete audit.
12. Performance/regression: >1,000 and >5,000 synthetic contacts, high-volume histories, DB counts/keyset paging, responsive comparison, existing CRM/inbox/integration suites. No real provider sends/account reconnections.

Future hosted DDL is a separately approved packet with schema/checksum preflight, recoverable backup/restore evidence and synthetic-only validation.

## 11. Recommended phases and exact first coding packet

| Packet | Result | Entry/exit gate |
| --- | --- | --- |
| CONTACT-001A | Authorized contact reads, actionable conflicts and read-only comparison; contain old merge bypass and related view exposure. No merge execution. | PA approves narrow contact-security/migration scope; QA/security prove no hidden-contact/history disclosure. |
| CONTACT-001B | Deterministic rules, durable distinct decisions, staff proposals and manager review queue. | Shared-identifier, staff and review policies approved; pair/revision tests pass. |
| CONTACT-001C | Canonical lifecycle, versions, writer/read integration, immutable audit/operation data and atomic engine tested locally/staging. Hosted execution disabled. | Complete actual relationship/writer map; additive migration/rollback and preservation/concurrency/access tests. |
| CONTACT-001D | Controlled approved hosted rollout and first explicitly reviewed merge. | Fresh backup/restore/schema gate; all writers accounted for; no conflicting external ownership; current approval/assignment/manifest. Stop if safeguard fails. |
| CONTACT-001E | Controlled reversal, drift monitoring and optional fuzzy/multi-identity cases. | Reversal/retention evidence; separate extension or advanced automation approval. |

### CONTACT-001A — Authorized candidate review and actionable correction conflicts

**Objective:** identify permitted conflicting records and compare safely without introducing merge execution.

**Scope:** api/contacts.ts; shared contacts auth/read/candidate server module; structured editIdentity 409 projection; Contacts/ContactProfile and a bounded comparison component; narrowly approved contact-dependent view repair; tests/docs.

Requirements:

1. Fresh canonical auth; owner/manager business read scope versus verified assigned-rep scope. Update legitimate UI auth callers; preserve trusted integration-side helper behavior.
2. Inventory alternate contact exposure through legacy contact/organization routes/views. Contain old merge route rather than leaving a public bypass. Existing connections/send/webhook configuration remain untouched.
3. Reasoned, scoped candidate projection and DB counts/paging; preserve draft and visible-count labeling.
4. View/Compare shows matched/conflicting fields, provenance, independently authorized history summaries and unknown identity evidence.
5. Keep current correction role scope. Future Suggest/Merge controls clearly unavailable until their packets, not fake working buttons.
6. Safely replace the missing enrichment-check endpoint. No incidental enrichment overwrite.
7. Independent QA/security and actual auth/DOM tests; no merge/provider identity rewrite/customer cleanup.

**Acceptance:** an authorized owner sees the permitted record matching an attempted email correction and can view/compare without losing edits. A rep cannot enumerate another rep's contact/history. Legacy alternatives cannot bypass the contract. No contact merged/deleted. Any hosted security migration is independently authorized before application.

## 12. Decisions requiring owner / PA input

1. **Shared identifiers:** allow reviewed company/family mailboxes/phones? Recommended explicit reviewed pair/evidence policy, not unique email/phone.
2. **Staff correction:** owner/manager-only initially, or later assigned-only? Recommend staged expansion after access tests.
3. **Not duplicates authority:** recommend owner/manager business-wide confirmation, staff suggestions.
4. **Primary/assignment:** stable verified record preferred; ownership conflict blocks pending explicit access review. Child task/deal ownership stays unchanged unless separately chosen.
5. **Approval separation:** second manager or audited sole-owner exception? Neither permits automatic approval/execution.
6. **External ownership:** initial release blocks different/unknown verified ownership. Multi-number/store consolidation requires an explicit verified linking policy; no similarity-based equivalence.
7. **Audit/reversal:** choose retention/access and reversal limits; no guaranteed Undo after later writes.
8. **Next work:** approve CONTACT-001A before code/schema changes. This plan authorizes no security repair, credential change, migration, merge or deployment.

## 13. Assessment provenance and handoff

- Required context docs were read; some historical status text is superseded by current source/hosted evidence.
- GitNexus query for contact duplicate/merge flows returned no processes/definitions. No production symbol edited. Manual focused callers/relationships reviewed; detect_changes unavailable, git diff/status scope verification used.
- Hosted inspection covered columns, FK/check/unique constraints, leading indexes, RLS/grants, trigger/function names, view definitions and counts. No customer names/identifiers/message content or credential values were output or included.
- Catalog evidence overrides stale SQL assumptions: WhatsApp call link has no FK; webhook target absent; merge RPC/revision trigger absent.
- Synthetic correction tests are not hosted merge/approval/reversal/provider-ownership proof.
- Planning commit remains local: branch pushes create Vercel previews in this project, and deployment is prohibited for this task. No push/PR/merge. Documentation publication can be arranged separately after verifying a no-deploy path.

Official references consulted:

- [Supabase function security/privileges](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS and views](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL 17 explicit locking/deadlocks](https://www.postgresql.org/docs/17/explicit-locking.html)
- [Supabase changelog](https://supabase.com/changelog.md); current guidance consulted, no upgrade/configuration change proposed.

### Independent document review

[Certain] Independent factual/requirements QA: PASS. Full document reconciled with the request, source assessment and hosted relationship evidence. Existing 27-test evidence and its hash-comparison limitation were verified.

[Certain] Independent security review: PASS after clarification of completed-operation retry ordering in section 8. A recorded authorized same-key/same-payload result is reconciled before pre-execution revision checks. The clarification changes design only.

No implementation is approved by these reviews. Principal Architect review remains required.
