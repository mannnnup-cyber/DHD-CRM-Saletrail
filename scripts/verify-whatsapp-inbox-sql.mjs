// Optional SQL integration harness. Requires PGlite in an external test runtime or
// locally installed dev runtime; never connects to hosted PostgreSQL.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const modulePath = process.env.FOLLOPS_PGLITE_MODULE || '@electric-sql/pglite';
const { PGlite } = await import(modulePath);
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY, role text, is_active boolean);
CREATE TABLE public.whatsapp_messages(id uuid PRIMARY KEY, chat_id text, provider text, direction text, created_at timestamptz);
GRANT SELECT ON public.user_profiles, public.whatsapp_messages TO service_role;
INSERT INTO user_profiles VALUES ('00000000-0000-4000-8000-000000000001','owner',true),('00000000-0000-4000-8000-000000000002','manager',true),('00000000-0000-4000-8000-000000000003','sales_rep',true);
INSERT INTO whatsapp_messages VALUES ('10000000-0000-4000-8000-000000000001','18760000000@s.whatsapp.net','evolution','inbound',now()),('10000000-0000-4000-8000-000000000002','18760000000@s.whatsapp.net','evolution','outbound',now()),('10000000-0000-4000-8000-000000000003','18760000001@s.whatsapp.net','evolution','inbound',now()),('10000000-0000-4000-8000-000000000004','18760000000@s.whatsapp.net','greenapi','inbound',now());`);
await db.exec(await readFile(new URL('../supabase/migrations/20261021172932_whatsapp_inbox_read_state.sql', import.meta.url), 'utf8'));
const owner='00000000-0000-4000-8000-000000000001', manager='00000000-0000-4000-8000-000000000002', rep='00000000-0000-4000-8000-000000000003', chat='18760000000@s.whatsapp.net', message='10000000-0000-4000-8000-000000000001';
const count = async actor => (await db.query('SELECT * FROM wa_inbox_unread($1, $2)', [actor,[chat]])).rows[0].unread_count;
const seen = (actor, ids) => db.query('SELECT wa_inbox_seen($1,$2,$3)',[actor,chat,ids]);
await db.exec('SET ROLE service_role');
assert.equal(Number(await count(owner)),1);
await seen(owner,[message,message]); await seen(owner,[message]); assert.equal(Number(await count(owner)),0); assert.equal(Number(await count(manager)),1);
for (const id of ['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004']) await assert.rejects(seen(owner,[id]));
await assert.rejects(seen(rep,[message])); await assert.rejects(seen(owner,[])); await assert.rejects(seen(owner,Array(1001).fill(message)));
await db.exec('RESET ROLE');
await db.exec(`INSERT INTO whatsapp_messages VALUES ('10000000-0000-4000-8000-000000000005','${chat}','evolution','inbound',now()-interval '2 days');`);
await db.exec('SET ROLE service_role');
assert.equal(Number(await count(owner)),1); await seen(owner,[message]); assert.equal(Number(await count(owner)),1);
await db.exec('RESET ROLE');
for (const role of ['anon','authenticated']) { await db.exec('SET ROLE '+role); await assert.rejects(db.query('SELECT * FROM whatsapp_inbox_receipts')); await assert.rejects(count(owner)); await assert.rejects(seen(owner,[message])); await db.exec('RESET ROLE'); }
assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.whatsapp_inbox_receipts'::regclass")).rows[0].relrowsecurity,true);
assert.equal((await db.query('SELECT count(*) AS n FROM whatsapp_messages')).rows[0].n,5);
await db.close(); console.log('PASS: receipt migration, exact counts, actor isolation, duplicate idempotence, delayed arrivals, wrong chat/direction/provider denial, role/RLS/execute denial, unchanged messages.');
