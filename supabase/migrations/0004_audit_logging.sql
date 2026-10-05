-- =============================================================================
-- La Kuku Chicken — 0004: audit logging
--
-- Administrative actions are recorded so an accidental or unauthorised change
-- can be investigated later.
--
-- The log is written by a database TRIGGER, not by the application. That is
-- deliberate: a trigger fires for any write, including one made directly
-- through the REST API by anyone who has discovered a working key, and it
-- records the authenticated user id from the JWT rather than a value the
-- caller supplies. An application-level log could simply be skipped.
--
-- NEVER logged: passwords, access tokens, service-role keys, JWT secrets.
-- Only the action, the target record and a small, non-sensitive diff.
-- =============================================================================

create table if not exists public.audit_logs (
  id            bigint generated always as identity primary key,

  -- The authenticated user at the time of the change. NULL for changes made
  -- with the service role (migrations, maintenance scripts).
  actor_user_id uuid references auth.users(id) on delete set null,

  action        text        not null,
  entity_type   text        not null,
  entity_id     uuid,

  -- Small jsonb detail bag. Deliberately narrow: identifiers, money amounts
  -- and booleans only. Never free-text bodies or credentials.
  details       jsonb,

  created_at    timestamptz not null default now(),

  constraint audit_logs_action_not_blank check (length(btrim(action)) > 0),
  constraint audit_logs_entity_type_valid check (
    entity_type in ('product', 'promotion', 'promotion_product', 'admin_profile', 'product_image')
  )
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

-- The log is append-only.
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

-- No INSERT policy for any role. Writes come only from the trigger below,
-- which runs as SECURITY DEFINER. Nothing can append fake log rows.
-- No UPDATE or DELETE policy either: entries cannot be edited or removed.

-- ---------------------------------------------------------------------------
-- Trigger that records product changes, including price changes.
-- ---------------------------------------------------------------------------
create or replace function public.audit_products()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text;
  v_details jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'product_created';
    v_details := jsonb_build_object(
      'name', new.name,
      'price', new.price,
      'unit', new.unit,
      'category', new.category,
      'is_available', new.is_available
    );
  elsif tg_op = 'DELETE' then
    v_action := 'product_deleted';
    v_details := jsonb_build_object('name', old.name, 'price', old.price);
  else
    -- Distinguish the operations the shop actually needs to investigate.
    if old.price is distinct from new.price then
      v_action := 'price_changed';
      v_details := jsonb_build_object(
        'name', new.name, 'old_price', old.price, 'new_price', new.price
      );
    elsif old.is_available is distinct from new.is_available then
      v_action := case when new.is_available
                       then 'product_enabled' else 'product_disabled' end;
      v_details := jsonb_build_object('name', new.name, 'is_available', new.is_available);
    elsif old.image_url is distinct from new.image_url then
      v_action := 'product_image_changed';
      v_details := jsonb_build_object('name', new.name, 'image_url', new.image_url);
    elsif old.description is distinct from new.description then
      v_action := 'product_description_changed';
      v_details := jsonb_build_object('name', new.name);
    else
      v_action := 'product_updated';
      v_details := jsonb_build_object('name', new.name);
    end if;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_action, 'product', coalesce(new.id, old.id), v_details);

  return coalesce(new, old);
end;
$$;

create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function public.audit_products();

-- ---------------------------------------------------------------------------
-- Trigger that records promotion changes.
-- ---------------------------------------------------------------------------
create or replace function public.audit_promotions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'promotion_created';
  elsif tg_op = 'DELETE' then
    v_action := 'promotion_deleted';
  elsif old.is_active is distinct from new.is_active then
    v_action := case when new.is_active
                     then 'promotion_activated' else 'promotion_deactivated' end;
  else
    v_action := 'promotion_updated';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    v_action,
    'promotion',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'name', coalesce(new.name, old.name),
      'discount_type', coalesce(new.discount_type, old.discount_type),
      'discount_value', coalesce(new.discount_value, old.discount_value),
      'is_active', coalesce(new.is_active, old.is_active)
    )
  );

  return coalesce(new, old);
end;
$$;

create trigger promotions_audit
  after insert or update or delete on public.promotions
  for each row execute function public.audit_promotions();

-- ---------------------------------------------------------------------------
-- Trigger for promotion <-> product link changes.
-- ---------------------------------------------------------------------------
create or replace function public.audit_promotion_products()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case when tg_op = 'DELETE' then 'promotion_product_removed'
         else 'promotion_product_added' end,
    'promotion_product',
    coalesce(new.product_id, old.product_id),
    jsonb_build_object('promotion_id', coalesce(new.promotion_id, old.promotion_id))
  );
  return coalesce(new, old);
end;
$$;

create trigger promotion_products_audit
  after insert or delete on public.promotion_products
  for each row execute function public.audit_promotion_products();
