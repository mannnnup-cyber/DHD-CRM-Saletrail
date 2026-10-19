-- Additive only. Authenticated browser roles have no direct access. Server validates
-- fresh Auth identity, then RPC rechecks canonical role and workspace membership.
begin;
create table public.social_workspaces (
 id uuid primary key, name text not null, timezone text not null default 'America/Jamaica' check(timezone='America/Jamaica'),
 accounts jsonb not null default '[]', created_at timestamptz not null default now()
);
insert into public.social_workspaces(id,name) values ('0b8f55a0-f110-4504-8e16-c9b6c79c5726','Dirty Hand Designs');
create table public.social_memberships (
 workspace_id uuid references public.social_workspaces(id), actor_id uuid references public.user_profiles(id),
 created_at timestamptz not null default now(), primary key(workspace_id,actor_id)
);
create table public.social_brands (
 workspace_id uuid primary key references public.social_workspaces(id), profile jsonb not null,
 version integer not null default 1, updated_by uuid references public.user_profiles(id), updated_at timestamptz not null default now()
);
insert into public.social_brands(workspace_id,profile) values ('0b8f55a0-f110-4504-8e16-c9b6c79c5726',
 '{"name":"Dirty Hand Designs","description":"Custom shirts, uniforms and gifts; printing and embroidery in Kingston, Jamaica.","products":"Custom shirts, uniforms, caps, aprons, personalised gifts","audiences":"Businesses and teams","voice":"Clear, friendly and practical","terminology":"","themes":"Team branding; finished work; ordering guidance","callsToAction":"DM QUOTE with item, quantity and preferred date","restrictions":"Do not invent prices, discounts, availability, testimonials or delivery dates."}');
create table public.social_campaigns (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.social_workspaces(id),
 name text not null check(length(name) between 1 and 120), objective text not null default '',
 starts_on date, ends_on date, created_by uuid references public.user_profiles(id), updated_at timestamptz not null default now(),
 check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
create table public.social_media (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.social_workspaces(id),
 provider_id uuid not null, sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), version integer not null default 1,
 filename text not null, mime text not null check(mime in ('image/jpeg','image/png')), bytes integer not null check(bytes between 1 and 2097152),
 width integer not null check(width between 1 and 10000), height integer not null check(height between 1 and 10000),
 title text not null default '', alt text not null default '', created_by uuid references public.user_profiles(id), created_at timestamptz not null default now(),
 unique(workspace_id,provider_id), unique(workspace_id,sha256)
);
create table public.social_posts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.social_workspaces(id),
 created_by uuid not null references public.user_profiles(id), campaign_id uuid references public.social_campaigns(id),
 version integer not null default 1, snapshot jsonb not null, fingerprint text not null,
 state text not null default 'draft' check(state in ('draft','awaiting_approval','approved','scheduled','publishing','published','failed','cancelled','uncertain','partial')),
 scheduled_at timestamptz, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index social_posts_calendar on public.social_posts(workspace_id,scheduled_at,id);
create table public.social_revisions (
 post_id uuid references public.social_posts(id), version integer, snapshot jsonb not null, fingerprint text not null,
 actor_id uuid not null references public.user_profiles(id), created_at timestamptz not null default now(), primary key(post_id,version)
);
create table public.social_approvals (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.social_posts(id), version integer not null,
 fingerprint text not null, actor_id uuid not null references public.user_profiles(id), decision text not null check(decision in ('approved','rejected')),
 created_at timestamptz not null default now(), unique(post_id,version,decision)
);
create table public.social_operations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.social_workspaces(id),
 post_id uuid references public.social_posts(id), version integer, account_id uuid, kind text not null check(kind in ('upload','create_schedule','update','cancel','reconcile')),
 identity text not null, request_fingerprint text not null, state text not null default 'in_flight' check(state in ('in_flight','succeeded','failed','uncertain')),
 attempts integer not null default 1, lease_token uuid not null default gen_random_uuid(), lease_until timestamptz not null default (now()+interval '60 seconds'),
 provider_id uuid, result jsonb, error_class text, actor_id uuid not null references public.user_profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,identity)
);
create table public.social_deliveries (
 post_id uuid references public.social_posts(id), version integer not null, account_id uuid, platform text not null check(platform in ('instagram','facebook')),
 provider_id uuid not null, status text not null, native_id text, published_at timestamptz, error_class text,
 verified_at timestamptz not null default now(), observed_at timestamptz not null default now(), primary key(post_id,version,account_id)
);
create unique index social_one_create_per_target on public.social_operations(post_id,version,account_id) where kind='create_schedule';
create table public.social_audit (
 id bigint generated always as identity primary key, workspace_id uuid not null references public.social_workspaces(id),
 post_id uuid references public.social_posts(id), actor_id uuid not null references public.user_profiles(id), event text not null,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.social_attributions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.social_workspaces(id),
 campaign_id uuid not null references public.social_campaigns(id), contact_id uuid references public.contacts(id), deal_id uuid references public.deals(id),
 evidence text not null check(length(evidence) between 1 and 1000), created_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now(),
 check(contact_id is not null or deal_id is not null)
);
create table public.social_ai_suggestions (
 id uuid primary key, workspace_id uuid not null references public.social_workspaces(id), actor_id uuid not null references public.user_profiles(id),
 kind text not null, prompt_fingerprint text not null, state text not null default 'pending' check(state in ('pending','completed','failed')),
 output text, created_at timestamptz not null default now()
);

create function public.social_require_actor(p_workspace uuid,p_actor uuid,p_owner boolean default false) returns text
language plpgsql security invoker set search_path='' as $$
declare r text;
begin
 select role into r from public.user_profiles where id=p_actor and is_active=true;
 if r is null or r not in ('owner','manager') or (p_owner and r<>'owner') then raise exception 'social_access_denied'; end if;
 if not exists(select 1 from public.social_memberships where workspace_id=p_workspace and actor_id=p_actor) then raise exception 'social_membership_required'; end if;
 return r;
end $$;

create function public.social_command(p_workspace uuid,p_actor uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text; p public.social_posts; v_snapshot jsonb; v_media jsonb; v_digest text; v_id uuid; c public.social_campaigns;
begin
 if p_action='initialize' then
  if not exists(select 1 from public.user_profiles where id=p_actor and is_active=true and role='owner') then raise exception 'social_access_denied'; end if;
  -- Only the seeded installation can be bootstrapped. Future workspaces require a reviewed migration.
  if p_workspace<>'0b8f55a0-f110-4504-8e16-c9b6c79c5726'::uuid or exists(select 1 from public.social_memberships where workspace_id=p_workspace) then raise exception 'social_already_initialized'; end if;
  perform 1 from public.social_workspaces where id=p_workspace for update;
  if exists(select 1 from public.social_memberships where workspace_id=p_workspace) then raise exception 'social_already_initialized'; end if;
  insert into public.social_memberships values(p_workspace,p_actor,now());
  update public.social_workspaces set accounts=p_input->'accounts' where id=p_workspace;
  insert into public.social_audit(workspace_id,actor_id,event) values(p_workspace,p_actor,'initialized');
  return jsonb_build_object('initialized',true);
 end if;
 r:=public.social_require_actor(p_workspace,p_actor,p_action in ('approve','reject','grant','revoke'));
 if p_action='aiReserve' then
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text||'ai',0));
  if exists(select 1 from public.social_ai_suggestions where id=(p_input->>'requestId')::uuid) then raise exception 'social_operation_exists'; end if;
  if (select count(*) from public.social_ai_suggestions where actor_id=p_actor and created_at>now()-interval '24 hours')>=20 then raise exception 'social_ai_daily_limit'; end if;
  insert into public.social_ai_suggestions(id,workspace_id,actor_id,kind,prompt_fingerprint) values((p_input->>'requestId')::uuid,p_workspace,p_actor,p_input->>'kind',p_input->>'fingerprint');
  insert into public.social_audit(workspace_id,actor_id,event) values(p_workspace,p_actor,'ai_requested');return jsonb_build_object('reserved',true);
 end if;
 if p_action in ('grant','revoke') then
  v_id:=(p_input->>'actorId')::uuid;
  if not exists(select 1 from public.user_profiles where id=v_id and is_active=true and role in ('owner','manager')) then raise exception 'social_access_denied'; end if;
  if p_action='grant' then insert into public.social_memberships(workspace_id,actor_id) values(p_workspace,v_id) on conflict do nothing;
  else if v_id=p_actor then raise exception 'social_cannot_revoke_self'; end if; delete from public.social_memberships where workspace_id=p_workspace and actor_id=v_id; end if;
  insert into public.social_audit(workspace_id,actor_id,event,details) values(p_workspace,p_actor,p_action,jsonb_build_object('actorId',v_id));
  return jsonb_build_object('success',true);
 end if;
 if p_action='brand' then
  update public.social_brands set profile=p_input,version=version+1,updated_by=p_actor,updated_at=now() where workspace_id=p_workspace;
  insert into public.social_audit(workspace_id,actor_id,event) values(p_workspace,p_actor,'brand_changed'); return p_input;
 end if;
 if p_action='campaign' then
  v_id:=coalesce((p_input->>'id')::uuid,gen_random_uuid());
  insert into public.social_campaigns(id,workspace_id,name,objective,starts_on,ends_on,created_by) values(v_id,p_workspace,p_input->>'name',p_input->>'objective',nullif(p_input->>'startsOn','')::date,nullif(p_input->>'endsOn','')::date,p_actor)
  on conflict(id) do update set name=excluded.name,objective=excluded.objective,starts_on=excluded.starts_on,ends_on=excluded.ends_on,updated_at=now() where social_campaigns.workspace_id=p_workspace returning * into c;
  if c.id is null then raise exception 'social_campaign_unavailable'; end if; return to_jsonb(c);
 end if;
 if p_action='attribution' then
  if not exists(select 1 from public.social_campaigns where id=(p_input->>'campaignId')::uuid and workspace_id=p_workspace) then raise exception 'social_campaign_unavailable'; end if;
  if p_input->>'contactId' is not null and not exists(select 1 from public.contacts where id=(p_input->>'contactId')::uuid) then raise exception 'social_contact_unavailable'; end if;
  if p_input->>'dealId' is not null and not exists(select 1 from public.deals where id=(p_input->>'dealId')::uuid) then raise exception 'social_deal_unavailable'; end if;
  insert into public.social_attributions(workspace_id,campaign_id,contact_id,deal_id,evidence,created_by) values(p_workspace,(p_input->>'campaignId')::uuid,(p_input->>'contactId')::uuid,(p_input->>'dealId')::uuid,p_input->>'evidence',p_actor);
  return jsonb_build_object('success',true);
 end if;
 v_id:=coalesce((p_input->>'id')::uuid,gen_random_uuid());
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 select * into p from public.social_posts where id=v_id and workspace_id=p_workspace for update;
 if p_action='save' then
  if p.id is not null and (p.version is distinct from (p_input->>'version')::integer or p.state not in ('draft','awaiting_approval','approved','cancelled')) then raise exception 'social_revision_conflict'; end if;
  if exists(select 1 from public.social_operations where post_id=v_id and state in ('in_flight','uncertain')) then raise exception 'social_operation_unresolved'; end if;
  if jsonb_typeof(p_input->'accounts')<>'array' or jsonb_array_length(p_input->'accounts') not between 1 and 2 then raise exception 'social_accounts_invalid'; end if;
  if exists(select 1 from jsonb_array_elements(p_input->'accounts') a where not exists(select 1 from public.social_workspaces w,jsonb_array_elements(w.accounts) wa where w.id=p_workspace and wa->>'id'=a->>'id' and wa->>'platform'=a->>'platform')) then raise exception 'social_account_denied'; end if;
  if length(p_input->>'caption') not between 1 and 10000 or length(coalesce(p_input->>'firstComment',''))>2200 then raise exception 'social_content_invalid'; end if;
  if jsonb_typeof(p_input->'mediaIds')<>'array' or jsonb_array_length(p_input->'mediaIds')>1 then raise exception 'social_media_invalid'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'providerId',m.provider_id,'sha256',m.sha256,'version',m.version) order by e.ordinality),'[]'::jsonb) into v_media
   from jsonb_array_elements_text(p_input->'mediaIds') with ordinality e(value,ordinality) join public.social_media m on m.id=e.value::uuid and m.workspace_id=p_workspace;
  if jsonb_array_length(v_media)<>jsonb_array_length(p_input->'mediaIds') then raise exception 'social_media_unavailable'; end if;
  if p_input->>'campaignId' is not null and not exists(select 1 from public.social_campaigns where id=(p_input->>'campaignId')::uuid and workspace_id=p_workspace) then raise exception 'social_campaign_unavailable'; end if;
  v_snapshot:=jsonb_build_object('caption',p_input->>'caption','firstComment',coalesce(p_input->>'firstComment',''),'accounts',p_input->'accounts','media',v_media,'scheduledAt',p_input->>'scheduledAt','settings',jsonb_build_object('format','image-first','timezone','America/Jamaica'));
  v_digest:=encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex');
  if p.id is null then
   insert into public.social_posts(id,workspace_id,created_by,campaign_id,snapshot,fingerprint,scheduled_at) values(v_id,p_workspace,p_actor,(p_input->>'campaignId')::uuid,v_snapshot,v_digest,(p_input->>'scheduledAt')::timestamptz) returning * into p;
  else update public.social_posts set snapshot=v_snapshot,fingerprint=v_digest,version=version+1,state='draft',campaign_id=(p_input->>'campaignId')::uuid,scheduled_at=(p_input->>'scheduledAt')::timestamptz,updated_at=now() where id=v_id returning * into p; end if;
  insert into public.social_revisions values(p.id,p.version,p.snapshot,p.fingerprint,p_actor,now());
 elsif p.id is null then raise exception 'social_post_unavailable';
 elsif p.version is distinct from (p_input->>'version')::integer then raise exception 'social_revision_conflict';
 elsif p_action='submit' then
  if p.state<>'draft' then raise exception 'social_state_conflict'; end if;
  update public.social_posts set state='awaiting_approval',updated_at=now() where id=p.id returning * into p;
 elsif p_action in ('approve','reject') then
  if p.state not in ('draft','awaiting_approval') then raise exception 'social_state_conflict'; end if;
  insert into public.social_approvals(post_id,version,fingerprint,actor_id,decision) values(p.id,p.version,p.fingerprint,p_actor,case when p_action='approve' then 'approved' else 'rejected' end);
  update public.social_posts set state=case when p_action='approve' then 'approved' else 'draft' end,updated_at=now() where id=p.id returning * into p;
 else raise exception 'social_unknown_action'; end if;
 insert into public.social_audit(workspace_id,post_id,actor_id,event,details) values(p_workspace,p.id,p_actor,p_action,jsonb_build_object('version',p.version,'fingerprint',p.fingerprint));
 return to_jsonb(p);
end $$;

create function public.social_claim(p_workspace uuid,p_actor uuid,p_kind text,p_identity text,p_fingerprint text,p_post uuid default null,p_version integer default null,p_account uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.social_operations; p public.social_posts;
begin
 perform public.social_require_actor(p_workspace,p_actor,p_kind<>'reconcile' and p_kind<>'upload');
 if p_kind not in ('upload','create_schedule','update','cancel','reconcile') or (p_kind<>'upload' and (p_post is null or p_version is null or p_account is null)) then raise exception 'social_kind_invalid'; end if;
 if length(p_identity) not between 1 and 200 or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'social_identity_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text||p_identity,0));
 select * into o from public.social_operations where workspace_id=p_workspace and identity=p_identity for update;
 if o.id is not null then
  if o.request_fingerprint<>p_fingerprint or o.kind<>p_kind or o.post_id is distinct from p_post or o.version is distinct from p_version or o.account_id is distinct from p_account then raise exception 'social_identity_conflict'; end if;
  if o.state='in_flight' and o.lease_until<now() then update public.social_operations set state='uncertain',error_class='lease_expired',updated_at=now() where id=o.id returning * into o; end if;
  return jsonb_build_object('dispatch',false,'operation',to_jsonb(o));
 end if;
 if p_post is not null then
  select * into p from public.social_posts where id=p_post and workspace_id=p_workspace for update;
  if p.id is null or p.version is distinct from p_version then raise exception 'social_revision_conflict'; end if;
  if p_kind='create_schedule' then
   if p.state not in ('approved','scheduled','partial','publishing') or not exists(select 1 from public.social_approvals where post_id=p.id and version=p.version and fingerprint=p.fingerprint and decision='approved') then raise exception 'social_approval_required'; end if;
   if p.scheduled_at is null or p.scheduled_at<now()+interval '2 minutes' then raise exception 'social_schedule_invalid'; end if;
   if not exists(select 1 from jsonb_array_elements(p.snapshot->'accounts') a where a->>'id'=p_account::text) then raise exception 'social_account_denied'; end if;
   if exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and account_id=p_account) or exists(select 1 from public.social_operations where post_id=p.id and version=p.version and account_id=p_account and kind='create_schedule') then raise exception 'social_delivery_exists'; end if;
   update public.social_posts set state='publishing',updated_at=now() where id=p.id;
  elsif p_kind not in ('cancel','reconcile','update') then raise exception 'social_kind_invalid'; end if;
  if p_kind in ('cancel','reconcile','update') then
   if not exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and account_id=p_account) then raise exception 'social_delivery_unavailable'; end if;
   update public.social_operations set state='uncertain',error_class='lease_expired',updated_at=now() where post_id=p.id and version=p.version and account_id=p_account and state='in_flight' and lease_until<now();
   if exists(select 1 from public.social_operations where post_id=p.id and version=p.version and account_id=p_account and state='in_flight') then raise exception 'social_operation_running'; end if;
  end if;
 end if;
 insert into public.social_operations(workspace_id,post_id,version,account_id,kind,identity,request_fingerprint,actor_id) values(p_workspace,p_post,p_version,p_account,p_kind,p_identity,p_fingerprint,p_actor) returning * into o;
 insert into public.social_audit(workspace_id,post_id,actor_id,event,details) values(p_workspace,p_post,p_actor,'operation_claimed',jsonb_build_object('operationId',o.id,'kind',p_kind));
 return jsonb_build_object('dispatch',true,'operation',to_jsonb(o));
end $$;

create function public.social_finish(p_workspace uuid,p_actor uuid,p_operation uuid,p_token uuid,p_state text,p_provider uuid,p_result jsonb,p_error text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.social_operations; p public.social_posts; child jsonb; v_state text;
begin
 perform public.social_require_actor(p_workspace,p_actor);
 select * into o from public.social_operations where id=p_operation and workspace_id=p_workspace for update;
 if o.id is null or o.actor_id is distinct from p_actor or o.lease_token is distinct from p_token or o.state<>'in_flight' then raise exception 'social_operation_fence'; end if;
 if p_state not in ('succeeded','failed','uncertain') then raise exception 'social_state_invalid'; end if;
 -- Late responses cannot assert completion after another operator may have started reconciliation.
 if o.lease_until<now() then p_state:='uncertain'; p_error:='lease_expired'; end if;
 update public.social_operations set state=p_state,provider_id=p_provider,result=p_result,error_class=p_error,updated_at=now() where id=o.id returning * into o;
 if o.post_id is not null then
  select * into p from public.social_posts where id=o.post_id for update;
  if p_state='succeeded' and p_provider is not null and o.kind in ('create_schedule','cancel','reconcile','update') then
   child:=p_result->'children'->0;
   if p.version is distinct from o.version or jsonb_typeof(p_result->'children') is distinct from 'array' or jsonb_array_length(p_result->'children') is distinct from 1 or child->>'accountId' is distinct from o.account_id::text or p_result->>'id' is distinct from p_provider::text then raise exception 'social_result_scope'; end if;
   if not exists(select 1 from jsonb_array_elements(p.snapshot->'accounts') a where a->>'id'=o.account_id::text and a->>'platform'=child->>'platform') then raise exception 'social_result_scope'; end if;
   if o.kind in ('cancel','reconcile','update') and not exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and account_id=o.account_id and provider_id=p_provider) then raise exception 'social_provider_identity'; end if;
   v_state:=coalesce(child->>'status','uncertain');
   if v_state='published' and (coalesce(child->>'nativeId','')='' or child->>'publishedAt' is null) then v_state:='uncertain'; end if;
   if o.kind='cancel' and v_state='draft' then v_state:='cancelled'; end if;
   if v_state not in ('draft','scheduled','publishing','published','failed','cancelled','uncertain') then v_state:='uncertain'; end if;
   insert into public.social_deliveries(post_id,version,account_id,platform,provider_id,status,native_id,published_at,error_class,observed_at) values(p.id,o.version,o.account_id,child->>'platform',p_provider,v_state,child->>'nativeId',(child->>'publishedAt')::timestamptz,case when child->>'error' is null then null else 'provider_failure' end,o.created_at)
   on conflict(post_id,version,account_id) do update set status=excluded.status,native_id=excluded.native_id,published_at=excluded.published_at,error_class=excluded.error_class,verified_at=now(),observed_at=excluded.observed_at where social_deliveries.observed_at<=excluded.observed_at and (social_deliveries.status<>'published' or excluded.status='published');
  end if;
  if o.kind='reconcile' and p_state='succeeded' then
   update public.social_operations set state='succeeded',error_class=null,updated_at=now() where post_id=p.id and version=p.version and account_id=o.account_id and provider_id=p_provider and state='uncertain' and ((kind='cancel' and v_state in ('cancelled','published')) or kind='reconcile');
  end if;
  if exists(select 1 from public.social_operations where post_id=p.id and version=p.version and state='uncertain') then v_state:='uncertain';
  elsif exists(select 1 from public.social_operations where post_id=p.id and version=p.version and state='in_flight') then v_state:='publishing';
  elsif (select count(*) from public.social_deliveries where post_id=p.id and version=p.version)<jsonb_array_length(p.snapshot->'accounts') then v_state:=case when p_state='failed' then 'failed' else 'partial' end;
  elsif not exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and status<>'published') then v_state:='published';
  elsif not exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and status='published') and not exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and status<>'cancelled') then v_state:='cancelled';
  elsif not exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and status<>'scheduled') then v_state:='scheduled';
  elsif exists(select 1 from public.social_deliveries where post_id=p.id and version=p.version and status in ('failed','uncertain')) then v_state:='failed';
  else v_state:='partial'; end if;
  update public.social_posts set state=v_state,updated_at=now() where id=p.id;
 end if;
 insert into public.social_audit(workspace_id,post_id,actor_id,event,details) values(p_workspace,o.post_id,p_actor,'operation_'||p_state,jsonb_build_object('operationId',o.id,'kind',o.kind,'errorClass',p_error));
 return to_jsonb(o);
end $$;

create function public.social_recover(p_workspace uuid,p_actor uuid,p_operation uuid,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.social_operations; p public.social_posts; token uuid:=gen_random_uuid();
begin
 perform public.social_require_actor(p_workspace,p_actor,true);
 select * into o from public.social_operations where id=p_operation and workspace_id=p_workspace for update;
 if o.id is null or o.kind<>'create_schedule' or (o.state<>'uncertain' and not(o.state='in_flight' and o.lease_until<now())) then raise exception 'social_recovery_unavailable'; end if;
 select * into p from public.social_posts where id=o.post_id and version=o.version for update;
 if p.id is null or p_result->>'caption' is distinct from p.snapshot->>'caption' or p_result->>'firstComment' is distinct from p.snapshot->>'firstComment' then raise exception 'social_recovery_content'; end if;
 if exists(select 1 from public.social_deliveries where provider_id=(p_result->>'id')::uuid and (post_id<>p.id or version<>p.version or account_id<>o.account_id)) then raise exception 'social_recovery_duplicate'; end if;
 update public.social_operations set state='in_flight',actor_id=p_actor,lease_token=token,lease_until=now()+interval '60 seconds' where id=o.id;
 insert into public.social_audit(workspace_id,post_id,actor_id,event,details) values(p_workspace,p.id,p_actor,'owner_media_and_schedule_attestation',jsonb_build_object('operationId',o.id,'providerId',p_result->>'id'));
 return public.social_finish(p_workspace,p_actor,o.id,token,'succeeded',(p_result->>'id')::uuid,p_result,null);
end $$;

do $$ declare t text; begin
 foreach t in array array['social_workspaces','social_memberships','social_brands','social_campaigns','social_media','social_posts','social_revisions','social_approvals','social_operations','social_deliveries','social_audit','social_attributions','social_ai_suggestions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.social_audit_id_seq to service_role;
revoke all on sequence public.social_audit_id_seq from public,anon,authenticated;
revoke all on function public.social_require_actor(uuid,uuid,boolean),public.social_command(uuid,uuid,text,jsonb),public.social_claim(uuid,uuid,text,text,text,uuid,integer,uuid),public.social_finish(uuid,uuid,uuid,uuid,text,uuid,jsonb,text),public.social_recover(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.social_require_actor(uuid,uuid,boolean),public.social_command(uuid,uuid,text,jsonb),public.social_claim(uuid,uuid,text,text,text,uuid,integer,uuid),public.social_finish(uuid,uuid,uuid,uuid,text,uuid,jsonb,text),public.social_recover(uuid,uuid,uuid,jsonb) to service_role;
commit;
