# CONTACT-001A - Pre-release verification

Superseding evidence packet: docs/CONTACT-001A-ARCHITECT-REVIEW-RESPONSE.md records subsequent local corrections and their final verification. The 347-test checkpoint below remains historical. Publication and production release remain blocked.

Date: 2026-10-23 (America/Bogota)
Application source reviewed: 4a95862de83bcddedc850df37997153c539545a2
Patch applicability base (production origin/master): b3b55c82b31decba8a7bd66bdaa20b086a14d383
Branch: feat/contact-001a-secure-review
Supabase project: vatsonbvjkyzxqrnderr

## Verdict

**Application/source verification: PASS**, subject to the explicit hosted and browser limits below.

**GitHub publication under the no-deployment restriction: BLOCKED.** An existing active GitHub push webhook targets Vercel's deployment-hook endpoint independently of the normal Git integration. The narrowly prepared branch guard does not control that separate trigger. No push, remote feature-branch SHA or GitHub review URL is reported. The hook was not disabled or changed because it may serve existing production deployment behavior.

No migration, deployment, contact merge/deletion, customer-data modification, provider request or credential change was performed in this verification.

## 1. Fresh local verification

- Independent QA: **347/347 tests PASS across25 files**, full final application/test source,140.20 seconds. This supersedes the earlier pre-delta344-test evidence for this pre-release check.
- Fresh final type-check: PASS (npm run type-check, exit0).
- Fresh final production build: PASS (exit0,2784 modules,1 minute16 seconds; index1308.58kB, gzip347.87kB).
- Independent source security review: PASS for the scoped contact permission/candidate/compare implementation; hosted SQL remediation remains unapplied.
- Config JSON comparison PASS: after removing the newly added git property, all existing vercel.json values equal the committed original. Git diff --check PASS.
- DOM tests cover responsive comparison structure, keyboard focus/Tab/Escape/return focus, correction-draft retention, stale requests and permission behavior. No actual mobile screenshot or hosted mutation/browser acceptance test was performed.
- Mocked handlers and native emitted ESM tests are local evidence, not proof of hosted Supabase Auth/PostgREST execution.

## 2. Narrow Vercel Git guard and independent blocker

The only configuration addition is:

```json
"git": {
  "deploymentEnabled": {
    "feat/contact-001a-secure-review": false
  }
}
```

The exact branch key contains no wildcard. Existing framework/build/install/dev/output settings, function durations and cron configuration are preserved. Production and unspecified branches retain their existing behavior; Vercel documents unspecified branches as enabled.

Additional inspection limit: the Vercel connector returned403 for the actual team/project, so live project verification through that connector was unavailable. The independent active deployment-hook observation came from read-only GitHub hook inspection.

Official reference: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

This setting addresses Git-integration deployment creation for matching commits. It is not a global deployment lock and does not disable manual CLI/API deployments or independent deploy hooks.

Read-only GitHub hook inspection found an active push-event webhook whose destination hostname is api.vercel.com and whose path begins /v1/integrations/deploy/. The secret-bearing full path/URL is intentionally omitted. GitHub push-event webhooks have no configured branch filter here. The destination's exact deployment target was not changed or exercised. Because a push can call that independent endpoint, the no-deployment condition cannot be established through the branch guard alone.

No test push was made. Existing hooks, Vercel project settings, production branch configuration and credentials remain unchanged. A local reviewable patch is the delivery path while this blocker remains; the lead provides its actual artifact location separately. Resolving publication requires an explicitly approved change to the independent deployment trigger or another verified no-deploy handoff.

## 3. Hosted view state - read-only metadata only

Fresh metadata observations:

- enrichment_status, org_members_all and org_members_current remain owned by postgres with reloptions NULL: security_invoker=true is not set.
- All three views retain SELECT grants for anon, authenticated and service_role.
- contacts and contact_organizations have row-level security enabled, FORCE RLS false, and SELECT grants for those roles.
- pg_policies returned no policies for either base table.
- Migration-ledger count for version20261023205637 is zero.

These observations confirm that this prepared migration is **UNAPPLIED**. No customer rows or message contents were retrieved for this verification. HTTP/Data API exposure and post-migration hosted role behavior were not exercised.

### View-specific purpose, risk and intended effect

| View | Current purpose and owner-context concern | Prepared invoker behavior and compatibility limit |
| --- | --- | --- |
| public.enrichment_status | Selects contacts with enrichment_source, including contact identity and enrichment metadata/notes. Its postgres owner context can bypass the base contact RLS rather than use the browser caller's row visibility. | Apply caller permissions/RLS to contacts without changing columns, predicate or ordering. With current browser-role base grants and no allowing contact policy, those roles are expected to see no rows. Existing service-authorized access can retain its base-role privileges/bypass. A browser consumer relying on the former bypass will lose rows intentionally; no such reliance is promised compatible. |
| public.org_members_all | Joins member contacts, contact_organizations and organization contacts, including historical memberships and both endpoint identities. Owner context can expose relationships when the caller cannot read the base contacts/memberships. | All joined base-table permissions/RLS apply as the caller. Current deny-by-default browser policies are expected to produce no membership rows. View shape and historical-membership logic remain unchanged; an unscoped browser membership consumer must use an authorized server path. |
| public.org_members_current | Uses the same member/link/organization relationship but filters to memberships whose ended_at is NULL. Current-only filtering does not itself authorize either endpoint. | Apply the same caller/base-table permission checks while preserving ended_at filtering and output shape. Server access remains subject to its existing privileges; browser visibility is intentionally reduced under current policies. |

FORCE RLS false and a privileged owner explain why owner-context views can differ from direct browser base-table reads. The prepared change switches permission evaluation; it does not add permissive policies, browser grants or a new service privilege.

CONTACT-001A's contact/organization server handlers read the scoped base tables rather than depending on these three views. The prepared SQL therefore changes no application response schema or integration resolver. This source compatibility observation and local synthetic tests do not substitute for separately approved hosted application/consumer checks.

## 4. Prepared migration identity and validation

File: supabase/migrations/20261023205637_contact_review_view_security.sql
SHA256: **7d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7**
Created with Supabase CLI2.122.0 migration new after checking migration new --help. It contains one BEGIN/COMMIT transaction and exactly three ALTER VIEW SET(security_invoker=true) statements for the named views. A missing view fails rather than silently skipping. No base DML, table schema, view definition, role, grant, policy, credential or unrelated migration change is included.

Local synthetic PostgreSQL17.10 verification used a fresh disposable cluster with one synthetic base row, RLS, three owner-context views and anon/authenticated/service_role roles. The owner view exposed one synthetic row to anon before application. After applying the exact prepared transaction, all three view options were security_invoker=true; nine role/view count assertions passed: anon0, authenticated0, service_role1 for each view. The base row remained one. The server is stopped.

Synthetic cluster location outside Git: C:/Users/Administrator/.codex/private/follops-db-validation/contact-001a-synthetic. No cluster files or customer data are committed. This is local SQL evidence, not a hosted migration or hosted Data API test.

## 5. Compatibility and residual boundaries

- Locally implemented owner/manager contact workflows use fresh active canonical identity; verified reps are restricted to assigned contacts. Existing staff identity-edit permissions are not expanded.
- Comparison is read only and contains identity/provenance, authorized counts and bounded metadata. It is not an approved transfer manifest or provider-account ownership verification. No email/WhatsApp content is returned by comparison.
- Structured conflict paging retains its identifier-only match scope. The read-only discovery entrypoint may additionally use exact name hints. Matching fields may be shared; no probability or automatic merge is used.
- Trusted integration resolver copies, provider webhooks, existing WhatsApp/email connection settings and automation/cron paths were not changed by this verification. Broader legacy channel/automation security limitations remain outside this packet; the entire CRM is not claimed secure.
- Legacy merge/enrichment execution is contained locally. No Contact001B/C/D approval, durable distinct decision, canonical identity lifecycle or merge execution is enabled.
- Prepared view SQL still requires separate approval, fresh target/schema/backup/recovery safeguards and hosted validation. Current hosted owner-context behavior remains unresolved until then.
- The Vercel branch guard is necessary for the documented Git integration path but insufficient for the independently observed deployment hook. Publication remains blocked without changing or validating that separate trigger under explicit authorization.

## Handoff

Local source verification is suitable for Principal Architect review with the limits above. No remote SHA or deployment URL is supplied. The lead may commit this configuration/report locally and provide a reviewable patch without invoking the blocked push path. No merge, deployment or hosted SQL application is authorized by this report.
