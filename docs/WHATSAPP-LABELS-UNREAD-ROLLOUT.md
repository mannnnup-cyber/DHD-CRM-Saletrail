# WhatsApp phone labels and unread rollout

Status: hosted database validation PASS; production application deployment pending.
Implementation commit: `2ba495876297dc1182424892dc45f2b1c5d3a1e3`.
PR: https://github.com/mannnnup-cyber/DHD-CRM-Saletrail/pull/16

## Backup and recovery evidence

Target `vatsonbvjkyzxqrnderr` was verified through the target-specific PostgreSQL
session-pooler identity and native PostgreSQL17.6 connection. PostgreSQL17.10
clients created a repeatable-read snapshot backup outside Git:
`C:/Users/Administrator/.codex/private/follops-db-validation/backup-2026-10-21T19-58-24-704Z/`.
The protected parent grants access only to the local Administrator and SYSTEM.
No credentials or backup contents are committed.

- `application.dump`:199,866,747 bytes (190.6MiB), SHA256 `471fd58662169eef8486b29dbb6a87b12d3be25b5def93d0bbc14fb8b6a6783f`.
- `roles.sql`:5,653 bytes, SHA256 `8bc33b569a6ed76eeb57f83a230fa64007f936580221dd21b6e9d7b5dabfcb7c`.
- Coverage: all74 tables in public/auth/storage/supabase_migrations; application schema/data, auth data, storage metadata, extensions namespace, roles/grants. Database-role password hashes excluded; permitted authentication table data included.
- Exclusions: managed vault/realtime/GraphQL schemas, physical Storage object bytes, platform configuration and database-role password hashes. This is application-database recovery evidence, not a complete Supabase platform clone.

A disposable native PostgreSQL17.10 restore recovered all74 snapshot table counts
with zero mismatches. All42 existing public objects retained ownership, ACL and
RLS; all3 public function definitions/security/grants matched; policies, all31
source role attributes and22 effective role membership edges/options matched.

Local-only bootstrap differences were required: standard uuid-ossp/pgcrypto/
pg_stat_statements dependencies were installed and one already-created
extensions namespace CREATE entry was skipped in the local restore TOC. Original
archive data/function/table/ACL entries were retained. Nineteen role membership
GRANT statements used the disposable administrator as grantor rather than the
managed supabase_admin identity; member edges and ADMIN/INHERIT/SET options were
independently compared and matched. Original backup files remain unchanged.

## Migration and hosted verification

Approved source: `supabase/migrations/20261021172932_whatsapp_inbox_read_state.sql`.
SHA256: `470bae6722c526b2819b842155cf9d7211d8c8149ed29cad459d85a42a62bf53`.
The lead applied this exact SQL through Supabase apply_migration to register the
ledger; hosted ledger version is `20261021203508`, name
`whatsapp_inbox_read_state`. The tooling-generated ledger version differs from
the source filename. No BrightBean migration was applied.

Preflight found no conflicting receipt table or RPC. Fresh baselines captured42
public objects,427 columns,128 constraints,148 indexes,3 functions,0 policies
and31 roles. The approved SQL was first applied successfully to the restored
real schema and passed rollback functional tests.

Hosted native PostgreSQL checks PASS:

- Exactly1 new receipt table and2 RPCs; RLS and browser table/RPC denial verified.
- Actual service_role operation, verified owner/manager actor, exact counts,
  repeated/duplicate IDs, actor isolation and delayed-arrival preservation.
- Outbound and wrong-chat receipt rejection; no phone/provider calls.
- Synthetic messages and receipts were created only inside a transaction and
  rolled back; zero synthetic messages/receipts remained afterward.
- Existing public object ACL/ownership/RLS, functions/policies/role attributes,
  columns/constraints/indexes remained exactly unchanged. Effective membership
  edges/options also remained unchanged.

The functional test selected an existing authorised actor internally without
printing its identity or changing profiles. Message tables had no custom
INSERT trigger; profile/auth creation was avoided. No existing customer rows
were updated or deleted by the migration or validation SQL.

Counts compared against the earlier backup snapshot changed in8 tables during
the interval: auth MFA claims/sessions/refresh tokens, contacts, interactions,
WhatsApp chats/messages, and the migration ledger. These increases are
consistent with concurrent login/integration activity and ledger registration;
we do not claim all hosted row counts stayed constant. The other66 table counts
matched. Snapshot restore count equality remains verified separately.

## Application checks and limits

Independent QA and security: PASS. API/helper tests15/15; synthetic React UI
checks3/3; executable local PostgreSQL-compatible harness PASS; type-check and
production build PASS. GitHub checks passed for the reviewed implementation.

One compact menu reads existing phone label definitions. Evolution2.3.7 omits
chat-label associations from its API projection, so shared assignments,
filtering and conversation label chips remain blocked. No provider patch,
label mutation, phone merge/deletion or message send occurred.

Personal unread state marks only messages loaded in the open visible CRM
conversation. It is not a phone read receipt or proof of viewport viewing.
Existing stored history initially counts unread; badges cap at99+. The current
UI covers the first500 chats and up to1000 loaded messages per conversation;
older unseen history remains unread. Reps remain unavailable pending a verified
assignment access model. Legacy public WhatsApp routes and unsigned webhook
remain separate pre-existing risks.

Production deployment and live application checks will be recorded by the lead
following release. No claim of production UI activation is made by this report.
