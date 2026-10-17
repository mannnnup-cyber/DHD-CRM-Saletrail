-- REVIEW REQUIRED: additive Woo snapshot/checkpoint repair; no existing RLS/grants changes.
begin;
alter table public.woo_orders
  add column if not exists snapshot_observed_at timestamptz,
  add column if not exists order_number text,
  add column if not exists company text,
  add column if not exists provider_created_at timestamptz,
  add column if not exists provider_modified_at timestamptz,
  add column if not exists date_paid timestamptz,
  add column if not exists date_completed timestamptz,
  add column if not exists refund_amount numeric(15,2) not null default 0;
alter table public.woo_orders drop constraint if exists woo_orders_status_check;
alter table public.woo_orders add constraint woo_orders_status_check
  check (status ~ '^[a-z0-9][a-z0-9_-]{0,49}$') not valid;
create table if not exists public.woo_sync_state (
  id text primary key check (id = 'orders'),
  store_identity text,
  mode text not null default 'initial' check (mode in ('initial','catchup')),
  page integer not null default 1 check (page > 0),
  window_before timestamptz,
  modified_after timestamptz,
  last_success_at timestamptz,
  last_error text,
  failures integer not null default 0,
  retry_after timestamptz,
  lease_token uuid,
  lease_until timestamptz
);
alter table public.woo_sync_state enable row level security;
revoke all on public.woo_sync_state from public, anon, authenticated;
grant all on public.woo_sync_state to service_role;
insert into public.woo_sync_state(id) values ('orders') on conflict do nothing;

create or replace function public.woo_claim_sync(token uuid, store_identity text)
returns setof public.woo_sync_state language sql security invoker set search_path = '' as $$
  update public.woo_sync_state set lease_token=token, lease_until=now()+interval '90 seconds',
    window_before=coalesce(window_before,now()), store_identity=coalesce(woo_sync_state.store_identity,woo_claim_sync.store_identity)
  where id='orders' and (woo_sync_state.store_identity is null or woo_sync_state.store_identity=woo_claim_sync.store_identity) and (lease_until is null or lease_until<now())
    and (retry_after is null or retry_after<=now()) returning *;
$$;
create or replace function public.woo_finish_sync(token uuid, next_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.woo_sync_state set
    mode=next_state->>'mode', page=(next_state->>'page')::integer,
    window_before=(next_state->>'window_before')::timestamptz,
    modified_after=(next_state->>'modified_after')::timestamptz,
    last_success_at=(next_state->>'last_success_at')::timestamptz,
    last_error=next_state->>'last_error', failures=(next_state->>'failures')::integer,
    retry_after=(next_state->>'retry_after')::timestamptz,
    lease_token=null, lease_until=null
  where id='orders' and lease_token=token and lease_until>now();
  return found;
end;
$$;

-- A signed notification is only a signal to refetch; concurrent fetches can still
-- race, so the database rejects older modified timestamps atomically.
create or replace function public.woo_save_order(snapshot jsonb, store_identity text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare incoming public.woo_orders; previous public.woo_orders; changed boolean; affected boolean;
begin
  if not exists(select 1 from public.woo_sync_state where id='orders' and woo_sync_state.store_identity=woo_save_order.store_identity) then raise exception 'Store identity not initialized or mismatched'; end if;
  incoming := jsonb_populate_record(null::public.woo_orders, snapshot);
  if incoming.provider_modified_at is null or incoming.snapshot_observed_at is null then raise exception 'Version required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(incoming.woo_order_id,0));
  select * into previous from public.woo_orders where woo_order_id=incoming.woo_order_id;
  incoming.contact_id:=coalesce(previous.contact_id,incoming.contact_id);
  changed:=(to_jsonb(incoming)-array['id','created_at','updated_at','synced_at','snapshot_observed_at'])
    is distinct from (to_jsonb(previous)-array['id','created_at','updated_at','synced_at','snapshot_observed_at']);
  insert into public.woo_orders (woo_order_id,contact_id,customer_name,customer_email,
    customer_phone,billing_address,shipping_address,subtotal,tax_amount,shipping_amount,
    total_amount,currency,status,payment_method,order_notes,line_items,order_number,
    company,snapshot_observed_at,provider_created_at,provider_modified_at,date_paid,date_completed,refund_amount,synced_at,updated_at)
  values (incoming.woo_order_id,incoming.contact_id,incoming.customer_name,incoming.customer_email,
    incoming.customer_phone,incoming.billing_address,incoming.shipping_address,incoming.subtotal,
    incoming.tax_amount,incoming.shipping_amount,incoming.total_amount,incoming.currency,
    incoming.status,incoming.payment_method,incoming.order_notes,incoming.line_items,incoming.order_number,
    incoming.company,incoming.snapshot_observed_at,incoming.provider_created_at,incoming.provider_modified_at,incoming.date_paid,
    incoming.date_completed,incoming.refund_amount,now(),now())
  on conflict (woo_order_id) do update set
    contact_id=coalesce(public.woo_orders.contact_id,excluded.contact_id),customer_name=excluded.customer_name,
    customer_email=excluded.customer_email,customer_phone=excluded.customer_phone,
    billing_address=excluded.billing_address,shipping_address=excluded.shipping_address,
    subtotal=excluded.subtotal,tax_amount=excluded.tax_amount,shipping_amount=excluded.shipping_amount,
    total_amount=excluded.total_amount,currency=excluded.currency,status=excluded.status,
    payment_method=excluded.payment_method,order_notes=excluded.order_notes,line_items=excluded.line_items,
    order_number=excluded.order_number,company=excluded.company,snapshot_observed_at=excluded.snapshot_observed_at,
    provider_created_at=excluded.provider_created_at,provider_modified_at=excluded.provider_modified_at,
    date_paid=excluded.date_paid,date_completed=excluded.date_completed,refund_amount=excluded.refund_amount,
    synced_at=now(),updated_at=case when changed then now() else public.woo_orders.updated_at end
  where (public.woo_orders.provider_modified_at is null or
    excluded.provider_modified_at>public.woo_orders.provider_modified_at or
    (excluded.provider_modified_at=public.woo_orders.provider_modified_at and
      excluded.snapshot_observed_at>coalesce(public.woo_orders.snapshot_observed_at,'epoch'::timestamptz)))
;
  affected:=found;
  return affected and changed;
end;
$$;
revoke all on function public.woo_claim_sync(uuid,text) from public,anon,authenticated;
revoke all on function public.woo_finish_sync(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.woo_save_order(jsonb,text) from public,anon,authenticated;
grant execute on function public.woo_claim_sync(uuid,text), public.woo_finish_sync(uuid,jsonb), public.woo_save_order(jsonb,text) to service_role;
commit;
