# BB-08: controlled hosted migration validation

Date: 2026-10-20. **Verdict: BLOCKED before migration application.**

Project: `vatsonbvjkyzxqrnderr`. Branch: `feat/brightbean-content-studio`.
Approved baseline: `7315ec27ac0f30bc70b74aeb1399e031625862c4`.
Migration: `supabase/migrations/20261018000100_brightbean_content_studio.sql`.

## Required stop condition

A recoverable backup and its recovery availability could not be verified. The existing database connector permits project metadata and SQL checks but exposes no backup listing. The Supabase project's scheduled-backups dashboard displayed **Session expired — Please sign in again to continue**. No backup date, completion status, retention window or project-specific recovery option was available for inspection. No backup was created or restored. Project health and database access are not evidence of backup availability.

The owner's explicit safeguard therefore stopped execution before applying SQL. **Applied migration version: none. Database objects created: none.** No synthetic hosted records were created, so no cleanup or audit deletion occurred.

## Preflight evidence obtained in this run

- Local branch was clean at the exact approved commit before this report. No implementation or migration changes were made.
- Approved Git-blob SHA-256: `235cab495df660c75c30e38c341c32fd6bab98a4cddca31113eaa714eb3006d4` (32,056 bytes). The working copy's CRLF byte checksum is `fd0b865f60b3a04496369f61074782c7ab753c0f2c6855820866e9811be06589`; normalizing CRLF to LF exactly matches the approved blob. Any later application must use the approved SQL and its intended transaction boundary.
- Current connector metadata confirms the exact project reference, ACTIVE_HEALTHY status, us-east-1 region and PostgreSQL 17.6.
- Explicit hosted read-only transaction confirmed zero conflicting public social-prefixed objects, zero functions matching the six publishing RPC names, and no migration history entry for version `20261018000100`. The transaction was rolled back.
- BB-07 contains the prior detailed dependency, extension, RLS and grant compatibility inspection. This run refreshed project identity, PostgreSQL version and conflict checks; it did not repeat the full BB-07 catalog inspection after encountering the backup blocker.
- The publishing gate is absent from the two available local ignored environment files. This is **not** verification of the deployed environment. Existing Vercel access cannot inspect the target project's environment. Hosted gate state remains unverified; no gate or configuration was changed.
- The existing branch-specific Vercel deployment guard remains false for this feature branch. Only this report is committed and pushed; no deployment or merge is requested or performed.

## Hosted checks not executed

All thirteen new tables and six functions remain unapplied. Hosted RLS/grant denials, server operations, workspace initialization, owner/manager membership, approval invalidation, duplicate claims, audit creation and CRM attribution behavior were therefore not executed. Local SQL tests cannot establish hosted PostgREST/Auth behavior.

A full pre/post CRM schema, permission and row-count comparison was not performed because application stopped at the backup safeguard. No hosted mutation tool or DML was used during BB-08. Existing CRM data and permissions were not changed by this task; independent concurrent business activity was not assessed.

## Regression and external safety

No application, integration, migration, environment or provider setting was changed. No BrightBean media upload, scheduling or publication was performed. Instagram and Facebook were not disconnected. WhatsApp and email code/configuration were untouched. Live Social Inbox behavior was not independently exercised in this blocked run; local API/runtime regression results are recorded below.

## Local test evidence

**PASS: 54 tests across six files** (137.82 seconds): publishing SQL (11), provider contract (10), handler (8), Social Inbox API (21), exact-revision preview (3), and native emitted social/publishing runtime authentication (1). Provider tests use controlled fixtures; the native runtime test explicitly prohibits network access. SQL tests use synthetic local PGlite, not the hosted project. These results establish local regression coverage, not hosted migration success.

**PASS: TypeScript `tsc --noEmit`**, exit code 0. No application build or deployment was needed for this documentation-only result. GitNexus change detection is unavailable in this environment; git status/diff scope checks substitute for it. Only this report changed; no symbols were edited.

## Required next step

Restore dashboard access for this exact project and verify a completed recoverable backup, retention/recovery window and supported restore path without performing a restore. Verify the deployed publishing write gate is disabled or unset. Then repeat the full BB-07 dependency checks, capture the CRM schema/ACL/count baseline and confirm no conflicting migration before applying only the approved SQL. Hosted validation remains required; this report is not permission to bypass either safeguard.
