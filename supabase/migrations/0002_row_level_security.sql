-- =============================================================================
-- La Kuku Chicken — 0002: Row Level Security
--
-- RLS is the actual security boundary. Hiding a button in React is not access
-- control: anyone can call the Supabase REST API directly with the public
-- key. Every rule below is therefore enforced by Postgres, and the frontend
-- merely mirrors it for usability.
--
-- The browser holds only the PUBLISHABLE (anon) key. That key can see nothing
-- beyond what these policies allow.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helper.
--
-- SECURITY DEFINER is required here, and this is the one place it is safe:
-- reading admin_profiles under RLS from inside another policy would recurse
-- infinitely. Pinning search_path stops a caller from hijacking function
-- resolution to a table they control.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.admin_profiles
  where user_id = auth.uid();
$$;

-- True for any staff role. 'manager' is included so the future operator role
-- can be introduced without revisiting every policy.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and role in ('admin', 'manager')
  );
$$;

-- Full control. Reserved for actions that must not be delegated, such as
-- changing a user's role or deleting a product outright.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Restrict execution to the two roles that actually need these functions.
--
-- Revoking from PUBLIC is not sufficient on its own: Postgres evaluates EVERY
-- applicable policy for a role, so an `anon` SELECT on products also evaluates
-- the staff policy, which calls is_staff(). Without an explicit GRANT to anon
-- and authenticated, public reads fail with "permission denied for function
-- is_staff()". Revoke first, then grant to exactly the roles that need it.
revoke execute on function public.current_user_role() from public;
revoke execute on function public.is_staff() from public;
revoke execute on function public.is_admin() from public;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ===========================================================================
-- products
-- ===========================================================================
alter table public.products enable row level security;

-- The public site reads available products. Unauthenticated visitors included:
-- this is public catalogue data, which is why the table is readable at all.
drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products
  for select
  using (is_available);

-- Staff see everything, including disabled products, so they can re-enable.
drop policy if exists products_staff_read on public.products;
create policy products_staff_read
  on public.products
  for select
  using (public.is_staff());

-- Writes are staff-only. No INSERT/UPDATE/DELETE policy exists for anon or
-- authenticated non-staff, so those roles are denied by default rather than
-- being allowed through a permissive `USING (true)`.
drop policy if exists products_staff_insert on public.products;
create policy products_staff_insert
  on public.products
  for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists products_staff_update on public.products;
create policy products_staff_update
  on public.products
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists products_staff_delete on public.products;
create policy products_staff_delete
  on public.products
  for delete
  to authenticated
  using (public.is_staff());

-- ===========================================================================
-- promotions
-- ===========================================================================
alter table public.promotions enable row level security;

-- The public may read promotions that are live right now (is_active and
-- inside their date window, evaluated against the DATABASE clock, not the
-- browser clock, so an expired promotion stops being public automatically).
drop policy if exists promotions_public_read_live on public.promotions;
create policy promotions_public_read_live
  on public.promotions
  for select
  using (
    is_active
    and current_date between start_date and end_date
  );

-- Staff read everything, including drafts and expired promotions.
drop policy if exists promotions_staff_read on public.promotions;
create policy promotions_staff_read
  on public.promotions
  for select
  using (public.is_staff());

drop policy if exists promotions_staff_insert on public.promotions;
create policy promotions_staff_insert
  on public.promotions
  for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists promotions_staff_update on public.promotions;
create policy promotions_staff_update
  on public.promotions
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Deleting a promotion is a full-admin action: a manager can create and edit
-- pricing, but not destroy records.
drop policy if exists promotions_admin_delete on public.promotions;
create policy promotions_admin_delete
  on public.promotions
  for delete
  to authenticated
  using (public.is_admin());

-- ===========================================================================
-- promotion_products
-- ===========================================================================
alter table public.promotion_products enable row level security;

-- Public can see which live promotions cover which available products, which
-- is exactly what the product cards need to render a badge.
drop policy if exists promotion_products_public_read on public.promotion_products;
create policy promotion_products_public_read
  on public.promotion_products
  for select
  using (
    exists (
      select 1 from public.promotions pr
      where pr.id = promotion_products.promotion_id
        and pr.is_active
        and current_date between pr.start_date and pr.end_date
    )
    and exists (
      select 1 from public.products p
      where p.id = promotion_products.product_id
        and p.is_available
    )
  );

drop policy if exists promotion_products_staff_read on public.promotion_products;
create policy promotion_products_staff_read
  on public.promotion_products
  for select
  using (public.is_staff());

drop policy if exists promotion_products_staff_write on public.promotion_products;
create policy promotion_products_staff_write
  on public.promotion_products
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ===========================================================================
-- admin_profiles
--
-- Self-service read only: a signed-in user may confirm their own role (the
-- login flow needs this), and an admin may read all profiles. There is
-- deliberately NO insert/update/delete policy for ordinary staff, so nobody
-- can grant themselves a role by inserting a row.
-- ===========================================================================
alter table public.admin_profiles enable row level security;

drop policy if exists admin_profiles_self_read on public.admin_profiles;
create policy admin_profiles_self_read
  on public.admin_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists admin_profiles_admin_read on public.admin_profiles;
create policy admin_profiles_admin_read
  on public.admin_profiles
  for select
  to authenticated
  using (public.is_admin());

-- Only a full admin may change roles. Note the recursion guard: this policy
-- calls is_admin(), which is SECURITY DEFINER and therefore reads this table
-- bypassing RLS -- otherwise the check would recurse.
drop policy if exists admin_profiles_admin_write on public.admin_profiles;
create policy admin_profiles_admin_write
  on public.admin_profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===========================================================================
-- Public read model used by the website
--
-- Computes the displayed price in SQL so the price shown to a customer is
-- derived by the database from the current time, and is identical for every
-- visitor.
--
-- Determinism: a product is discounted only by the ONE promotion referenced
-- by products.active_promotion_id, and only while that promotion is_active and
-- within its window. Overlapping promotions can therefore never produce an
-- ambiguous price.
--
-- security_invoker = true makes the view run with the CALLER's permissions, so
-- the RLS policies above still apply to it. Without it a view would silently
-- bypass RLS by running as its owner.
-- ===========================================================================
create or replace view public.public_products
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.description,
  p.unit,
  p.category,
  p.image_url,
  p.is_available,

  -- List price, unchanged by any promotion.
  p.price                                  as list_price,

  -- The live promotion, if this product has one.
  pr.id                                    as promotion_id,
  pr.name                                  as promotion_name,
  pr.discount_type,
  pr.discount_value,
  pr.end_date                              as promotion_end_date,

  -- True only while the promotion is active AND inside its date window,
  -- measured with the database clock.
  (pr.id is not null)                      as is_promoted,

  -- Price the customer actually pays. Fixed discounts are clamped at zero so a
  -- misconfigured promotion can never produce a negative price.
  case
    when pr.id is null then p.price
    when pr.discount_type = 'percentage'
      then greatest(0, round(p.price * (100 - pr.discount_value) / 100))::integer
    else greatest(0, p.price - pr.discount_value)::integer
  end                                      as current_price,

  p.updated_at
from public.products p
left join public.promotions pr
  on pr.id = p.active_promotion_id
 and pr.is_active
 -- Expiry is decided by the database clock.
 and current_date between pr.start_date and pr.end_date
where p.is_available;

comment on view public.public_products is
  'Public catalogue with deterministic, database-computed effective price.';

grant select on public.public_products to anon, authenticated;
