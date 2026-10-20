# BB-07: hosted database readiness

Date: 2026-10-19. Project: `vatsonbvjkyzxqrnderr`. Baseline: `c38d7417e48a64d820b034a65144a01cd1828f06`, branch `feat/brightbean-content-studio`.

**Result: FIXED — ready to apply the corrected migration with owner approval.** Application of the migration is not authorized by this report.

## Actually verified on hosted Supabase

All SQL ran inside explicit read-only transactions. No customer records, credential values or messages were retrieved. Catalog queries and zero-row column probes verified:

- PostgreSQL 17.6; `postgres` can create in public and reference required tables. The server's `service_role` has public schema usage, BYPASSRLS and SELECT on user_profiles, contacts, deals and app_settings. Zero-row SELECT probes under SET LOCAL ROLE service_role succeeded; the transaction was rolled back.
- Required primary keys are UUID: user_profiles.id, contacts.id, deals.id. user_profiles.role is nonnull text constrained to owner/manager/sales_rep; is_active is nullable boolean, compatible with the implementation's explicit `=true` checks. app_settings setting_key/varchar and setting_value/text match the server reads.
- No public social_* table, sequence, index, composite type or named publishing function conflicts; migration history contains no version 20261018000100.
- Required built-ins exist and are executable by service_role: gen_random_uuid, sha256(bytea), convert_to, encode, hashtextextended and advisory transaction locks. A SHA-256 known-answer probe succeeded. Jamaica 10:00 converted to 15:00 UTC. plpgsql and pgcrypto are installed; no new extension is required.
- Existing dependency tables have RLS enabled and no policies. Their existing service-role access is compatible; this migration does not change those tables' RLS, policies or grants. Browser roles cannot create objects in public or inherit service_role.
- Hosted public default privileges broadly grant tables/functions/sequences to anon, authenticated and service_role. The migration explicitly revokes browser/public access on all its own new tables, functions and audit sequence. This was also tested locally with these broad defaults reproduced, rather than assuming PostgreSQL's restrictive defaults.
- Active DDL event-trigger definitions were inspected. Relevant actions notify PostgREST to reload schema; extension-specific hooks do not create BrightBean requests. The existing Realtime publication does not automatically include every table.
- Final read-only confirmation: zero hosted social_* objects and zero matching migration-history entries. The migration remains unapplied.

## Correction

The original new social_attributions foreign keys used NO ACTION. A local reproduction with the actual hosted dependency types confirmed that a campaign attribution would block existing deal deletion (`src/lib/supabase.ts` deleteDeal). The corrected, still-unapplied migration:

1. Uses ON DELETE SET NULL for contact/deal references, preserving attribution evidence, campaign and creator while allowing normal CRM deletion.
2. Requires an existing contact or deal when creating attribution through social_command, retaining campaign/workspace/membership checks. It permits historical rows to have both links null after deletion.
3. Excludes fully unlinked historical evidence from the active manualLinks count; the UI labels such history as a deleted CRM record.

The migration contains no direct ALTER of existing CRM tables and no changes to customer rows, existing profile/audit references or existing access policies. Initial application only creates new publishing objects and two configuration seed rows. Foreign-key creation may take normal short schema locks; no customer-data rewrite/backfill is present.

Local SQL tests now mirror the hosted role constraint, parent RLS posture and broad default privileges. The setup timeout was increased from 30 to 120 seconds because cold WASM initialization on this Windows host repeatedly exceeded 30 seconds; behavioral assertions were not relaxed. The first runs timed out during setup, then the unchanged nine-test SQL suite passed with an external larger setup allowance. The final committed expanded eleven-test suite passes with the hosted-style fixture.

A branch-specific `vercel.json` deploymentEnabled=false entry prevents automatic deployment when the required fix is pushed. It targets only feat/brightbean-content-studio; master behavior is unchanged. No Vercel deployment command or project-settings mutation was performed. Review this guard when approving a later release.

## Controls and tests

The migration creates thirteen RLS-enabled tables and six SECURITY INVOKER functions with empty search_path and service-only execution. Local tests verify owner approval, manager denial, revision invalidation, per-account duplicate prevention, lease-token fencing, uncertain-outcome recovery, independent platform results and effective browser denial even under the hosted default grants. CRM tests cover contact-only, deal-only and dual links, removal of the final target, preservation of evidence/creator/campaign, null or nonexistent target rejection, and honest active-link counts.

**53 targeted tests / 5 files PASS**, including eleven real local PostgreSQL tests, actual publishing provider/handler contracts, existing Social Inbox API regression and exact-revision preview wiring. TypeScript PASS. Production build PASS (2,786 modules; HTML 1,315.71 kB / gzip 349.41 kB; 2m46s). Independent QA and security precommit reviews PASS; exact commit confirmation is recorded in the final handoff.

The actual migration file has no HTTP calls, BrightBean scheduling calls, outbound-network functions, cron jobs or publishing triggers. Its new functions only manipulate local data and are created, not invoked for publication, by migration application. Actual BrightBean writes remain in the authenticated server code behind the separate default-off write gate.

## Remaining untested

This is a **hosted metadata/permission compatibility verification**, not execution of new DDL or new RPCs on hosted PostgreSQL. The corrected migration ran only in synthetic local PostgreSQL 18.6; hosted 17.6 primitives and dependencies were checked directly. Actual migration application, new hosted PostgREST/Auth/RLS behavior and concurrent live workloads remain untested until owner-approved application. No BrightBean upload, schedule, publication or account/setting change was performed. No deployment, merge, hosted data write or hosted permission change was performed.
