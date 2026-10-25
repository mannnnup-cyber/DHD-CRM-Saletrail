# CONTACT-001A — separate hosted view migration validation plan

Status: PREPARED ONLY. This document is not authorization to execute hosted DDL.
Target: Supabase `vatsonbvjkyzxqrnderr`, PostgreSQL 17.
Migration: `supabase/migrations/20261023205637_contact_review_view_security.sql`.
Approved-file SHA256: `7d6dde9cac0724eebd9de3957042ff2503bc7452632ed8b8a632cb986b5599f7`.

## Stop conditions and ownership

Obtain separate owner approval for the exact target/file, a maintenance window, backup access and synthetic hosted validation. Do not run a general migration push: other pending migrations are not authorized. Stop if the file checksum, definitions, dependencies, grants, policies or recorded initial view options differ; if a backup is incomplete; or if restore/recovery is unverified. SQL-editor access alone is not a full logical backup capability. Supabase Free does not require purchasing managed backups for this procedure.

## A. Recoverable backup before DDL

1. Use an authorized PostgreSQL direct/pooler connection for this exact project. Resolve the endpoint from the dashboard; do not infer project identity from an API URL or copy credentials into a report. Store the password in a restricted `PGPASSFILE`, not an argument or command history. Use TLS and a PostgreSQL 17-or-newer compatible client. Verify database identity and version with read-only queries. Stop without usable database credentials.
2. Create a new restricted directory outside Git and the repository. On Windows remove inherited access and grant only the current account and SYSTEM; verify its ACL. Do not upload dumps or customer row baselines to GitHub. Encrypt any transferred/off-device copy using the owner's approved storage and retention policy.
3. Capture `pg_dump --format=custom --file=<private-path>/application.dump --dbname=<nonsecret-connection-service>` for every accessible application schema, plus authentication data where permitted. Capture `pg_dumpall --roles-only --no-role-passwords` separately where permitted; never restore Supabase-managed role attributes indiscriminately. Keep schema definitions, grants, policies, sequences and all application data in scope. A failed or partial dump does not pass. Record inaccessible schemas and objects explicitly.
4. Record the three view definitions/options/owners/grants and base-table RLS/policies, schema fingerprints and exact application-table counts privately. Take a consistent dump and a schema freeze/maintenance window so the baseline is meaningful. A dump is not a backup of Supabase project settings, OAuth/provider secrets, Edge Functions, deployed code or Storage object bytes. Storage metadata is not the stored files. Identify any Storage objects needed by CRM and preserve them separately before calling the CRM backup complete.
5. Hash and size every backup file, run `pg_restore --list`, and restore into a disposable **local** PostgreSQL database using the same major version. Provision only required compatible placeholder roles and extensions; no external webhooks or application processes may run there. Preserve and report managed-schema limitations. Compare restored application schema, sequences, row counts, constraints and grants to the captured backup baseline. Check representative synthetic relationships, not customer contents in logs. If accessible CRM data cannot be completely restored, STOP.
6. Test both the targeted option rollback and dump/restore recovery on a disposable synthetic database, then repeat relevant validation on the actual private dump. Synthetic recovery establishes the method only; it does not verify the actual hosted backup. Report location, SHA256, size, coverage/exclusions and restore results without secrets or customer content.

## B. Exact read-only preflight

Execute only metadata queries before approval/application. Export results privately as the rollback baseline.

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user, version();
SELECT c.relname, c.reloptions, pg_get_userbyid(c.relowner) AS owner,
       c.relacl, pg_get_viewdef(c.oid, true) AS definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('enrichment_status','org_members_all','org_members_current');
SELECT * FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('contacts','contact_organizations');
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('contacts','contact_organizations');
SELECT * FROM information_schema.view_table_usage WHERE view_schema='public'
  AND view_name IN ('enrichment_status','org_members_all','org_members_current');
SELECT version FROM supabase_migrations.schema_migrations
WHERE version='20261023205637';
ROLLBACK;
```

Expected reviewed state: three postgres-owned views, NULL options, existing broad grants; both base tables RLS enabled and not forced, no policies; no migration-history entry. `service_role`/postgres bypass RLS; anon/authenticated/evolution_user do not. Recheck actual roles and every consumer before application. In particular `evolution_user` has view/base grants but no BYPASSRLS, so invoker access changes its reads too. Do not equate possession of a grant with permitted rows.

## C. Controlled execution — separate authorization required

After A/B pass, apply **only the exact file**, using `psql -X --set=ON_ERROR_STOP=1 --file=<approved-file> --dbname=<nonsecret-connection-service>`. The file contains its own BEGIN/COMMIT transaction. Do not add unrelated SQL or wrap a generic Supabase migration push around it. Stop on error; inspect transaction state rather than attempting additional fixes. Application via psql does not automatically add a Supabase migration-ledger row: report the execution method and resulting catalog state honestly. Any ledger reconciliation requires its own approved narrow procedure.

## D. Hosted validation — synthetic records only, separate approval

Verify all three options are `security_invoker=true`; definitions, ownership, dependencies, grants, base RLS/policies, unrelated objects and private CRM row baselines are unchanged. Test actual anon/authenticated/service API behavior and the affected consumers. Both organization endpoints must authorize each contact independently. Under the current deny-by-default base-table policy, anon/authenticated/evolution_user should see no rows through the views; service-role reads should preserve authorized server behavior. Test in a transaction with synthetic rows and roll back; do not use customer edits, merges or deletes. Never print customer rows, tokens or query bodies. Validate post-migration browser/PostgREST behavior separately from SQL-role checks. No provider operations are needed.

Hosted validation must also inspect enrichment_status's catalog-reported updatable/insertable behavior. Under separately authorized synthetic tests, assert browser INSERT/UPDATE/DELETE are denied by underlying policies without affecting customer rows; inspect both organization views' non-updatable behavior. Test these only with isolated synthetic records and rollback. Do not infer write safety solely from zero-row SELECT results or perform a real customer write as a probe.

## E. Recovery

Preferred targeted rollback, **only if separately authorized and the captured preflight options were NULL**, restores the exact prior view-option state without restoring customer data:

```sql
BEGIN;
ALTER VIEW public.enrichment_status RESET (security_invoker);
ALTER VIEW public.org_members_all RESET (security_invoker);
ALTER VIEW public.org_members_current RESET (security_invoker);
COMMIT;
```

This reintroduces the known owner-context exposure; require an explicit rollback decision and incident record. Do not silently revoke grants or add permissive policies as a workaround. If initial options differ, use the captured per-view values rather than this example. Validate definition/grant/schema/count fingerprints after rollback. If unrelated data/schema damage is found, stop writes and escalate to the tested private backup recovery procedure; do not overwrite a live database with an older dump without a separately approved recovery decision and write reconciliation. Preserve audit history.

## Acceptance packet

Include exact target/checksum/time, private backup evidence and exclusions, actual restore test, pre/post metadata comparisons, role/API/consumer results, synthetic cleanup/rollback proof, CRM invariants and explicit PASS/FIX REQUIRED/BLOCKED. No application release or social publishing is implied. Today no actual hosted backup/restore or hosted migration validation has been performed by this packet.
