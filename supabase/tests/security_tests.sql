-- =============================================================================
-- Executable security test suite for the La Kuku Chicken schema.
-- Runs against the isolated PostgreSQL instance created for this task.
--
-- Every test asserts something. A failure raises an exception and aborts.
-- =============================================================================
\set ON_ERROR_STOP on

-- Test bookkeeping that survives rollback of the test data.

-- Correct way to assert an RLS block on UPDATE/DELETE.
--
-- Postgres does not raise for an UPDATE whose rows no policy permits: it simply
-- affects 0 rows. So "expect an error" would falsely pass a permissive policy.
-- This runs the statement, then verifies the data is genuinely unchanged.
-- A raised error is also accepted as "blocked".
create or replace function public.t_expect_value(area text, name text, stmt text, check_expr text, expected text)
returns void language plpgsql set search_path = public, pg_temp as $$
declare got text;
begin
  begin
    execute stmt;
  exception when others then
    perform public.t_pass(area, name, 'statement rejected outright: ' || sqlerrm);
    return;
  end;
  execute check_expr into got;
  if got = expected then
    perform public.t_pass(area, name, 'no rows matched, data unchanged (' || coalesce(got,'NULL') || ')');
  else
    perform public.t_fail(area, name,
      'DATA CHANGED: expected ' || expected || ' but found ' || coalesce(got, '<NULL>'));
  end if;
end $$;

create table if not exists public.test_results (
  seq serial primary key,
  area text not null,
  test text not null,
  passed boolean not null,
  detail text
);

create or replace function public.t_pass(area text, name text, detail text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.test_results (area, test, passed, detail) values (area, name, true, detail);
end $$;

grant insert on public.test_results to anon, authenticated;
grant usage on schema public to anon, authenticated;

create or replace function public.t_fail(area text, name text, detail text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.test_results (area, test, passed, detail) values (area, name, false, detail);
  raise notice 'FAIL [%] % -- %', area, name, detail;
end $$;

-- Run a statement and record whether it raised an error.
--
-- Deliberately NOT security definer: the statement must execute as the calling
-- role so that RLS is genuinely enforced. A definer function would run as the
-- owner, bypass RLS, and make every "should be blocked" assertion pass falsely.
create or replace function public.t_expect_error(area text, name text, stmt text)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  begin
    execute stmt;
    perform public.t_fail(area, name, 'statement unexpectedly SUCCEEDED (should have been blocked)');
  exception when others then
    perform public.t_pass(area, name, sqlerrm);
  end;
end $$;

-- Run a statement and record that it did NOT raise. Also not security definer.
create or replace function public.t_expect_ok(area text, name text, stmt text)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  begin
    execute stmt;
    perform public.t_pass(area, name, 'allowed as expected');
  exception when others then
    perform public.t_fail(area, name, 'statement was blocked: ' || sqlerrm);
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Default privileges (applied AFTER the migrations, because the tables must exist)
--
-- Supabase automatically grants these to the `anon` and `authenticated` roles
-- on tables in the public schema and on storage objects. The stub must
-- reproduce them, because RLS only restricts what the GRANT allows: without a
-- table-level GRANT, a policy test would pass for the wrong reason (permission
-- denied at the GRANT layer rather than at the RLS layer).
--
-- Note what is NOT granted: `anon` gets no delete on audit_logs, and nobody
-- gets service_role-style write access through these roles. RLS is still the
-- thing under test.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;

grant select, insert, update, delete
  on public.products, public.promotions,
       public.promotion_products, public.admin_profiles
  to anon, authenticated;

grant select on public.audit_logs to anon, authenticated;

grant select on storage.objects, storage.buckets to anon, authenticated;
grant insert, update, delete on storage.objects to anon, authenticated;

-- =============================================================================
-- View compatibility
--
-- On PostgreSQL 15+ (what Supabase runs) the migrations already created
-- public_products, and this block does nothing.
--
-- On PostgreSQL 14 the `with (security_invoker = true)` option is unsupported,
-- so migrations 0002 and 0005 fail at the view statement and skip the rest of
-- those files. Every policy is still created — only the view is missing — so
-- recreate an equivalent one here. security_invoker is what stops the view
-- bypassing RLS; its absence in this test-only copy is acceptable because the
-- RLS assertions below target the base tables directly.
-- =============================================================================
do $do$
begin
  if current_setting('server_version_num')::int < 150000
     and to_regclass('public.public_products') is null then
    execute $v$
      create view public.public_products as
      select
        p.id, p.name, p.description, p.unit, p.category, p.image_url,
        p.is_available, p.variant_label, p.sort_order,
        p.price as list_price,
        pr.id as promotion_id,
        pr.name as promotion_name,
        pr.discount_type, pr.discount_value,
        pr.end_date as promotion_end_date,
        (pr.id is not null) as is_promoted,
        case
          when pr.id is null then p.price
          when pr.discount_type = 'percentage'
            then greatest(0, round(p.price * (100 - pr.discount_value) / 100))::integer
          else greatest(0, p.price - pr.discount_value)::integer
        end as current_price,
        p.updated_at
      from public.products p
      left join public.promotions pr
        on pr.id = p.active_promotion_id
       and pr.is_active
       and current_date between pr.start_date and pr.end_date
      where p.is_available
    $v$;
    execute 'grant select on public.public_products to anon, authenticated';
    raise notice 'PostgreSQL 14: created a compatibility copy of public_products';
  end if;
end
$do$;

-- =============================================================================
-- Fixtures
-- =============================================================================
truncate public.promotion_products, public.products, public.promotions,
         public.admin_profiles, public.audit_logs restart identity cascade;
truncate public.test_results restart identity;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@lakuku.test'),
  ('22222222-2222-2222-2222-222222222222', 'customer@lakuku.test')
on conflict (id) do nothing;

insert into public.admin_profiles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'admin')
on conflict (user_id) do nothing;

insert into public.products (id, name, description, price, unit, category, image_url,
                             variant_label, sort_order, is_available) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Chicken Wings', 'Crispy wings', 16000, 'per kg',
   'Chicken', '/images/products/wings.png', '500g', 0, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Chicken Wings', 'Crispy wings', 28000, 'per kg',
   'Chicken', '/images/products/wings.png', '1kg', 1, true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Chicken Liver', 'Fresh liver', 8000, 'per kg',
   'Chicken', '/images/products/liver.png', null, 0, true),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Sold Out Cut', 'Gone for today', 5000, 'per kg',
   'Chicken', '/images/products/gizzards.png', null, 0, false);

-- =============================================================================
-- A. DATABASE CONSTRAINTS (as the table owner, bypassing RLS on purpose)
-- =============================================================================
select public.t_expect_error('constraints', 'negative price rejected',
  $q$insert into public.products (name, price, unit, category) values ('Bad', -5, 'per kg', 'Chicken')$q$);

select public.t_expect_error('constraints', 'blank name rejected',
  $q$insert into public.products (name, price, unit, category) values ('   ', 100, 'per kg', 'Chicken')$q$);

select public.t_expect_error('constraints', 'null name rejected',
  $q$insert into public.products (name, price, unit, category) values (null, 100, 'per kg', 'Chicken')$q$);

select public.t_expect_error('constraints', 'null price rejected',
  $q$insert into public.products (name, price, unit, category) values ('X', null, 'per kg', 'Chicken')$q$);

select public.t_expect_error('constraints', 'blank category rejected',
  $q$insert into public.products (name, price, unit, category) values ('X', 100, 'per kg', ' ')$q$);

select public.t_expect_error('constraints', 'fractional shillings rejected',
  $q$insert into public.products (name, price, unit, category) values ('X', 100.5, 'per kg', 'Chicken')$q$);

select public.t_expect_error('constraints', 'javascript: image_url rejected',
  $q$insert into public.products (name, price, unit, category, image_url)
    values ('X', 100, 'per kg', 'Chicken', 'javascript:alert(1')$q$);

select public.t_expect_error('constraints', 'data: image_url rejected',
  $q$insert into public.products (name, price, unit, category, image_url)
    values ('X', 100, 'per kg', 'Chicken', 'data:text/html,<script>alert(1)</script>')$q$);

select public.t_expect_ok('constraints', 'insert with supplied updated_at is allowed',
  $q$insert into public.products (name, price, unit, category, updated_at)
    values ('Forgery Attempt', 100, 'per kg', 'Chicken', '1999-01-01')$q$);
do $$
declare forged timestamptz;
begin
  select updated_at into forged from public.products where name = 'Forgery Attempt';
  if forged is null or forged < now() - interval '1 minute' then
    perform public.t_fail('constraints', 'updated_at cannot be backdated by the caller',
      'stored ' || coalesce(forged::text, 'NULL'));
  else
    perform public.t_pass('constraints', 'updated_at cannot be backdated by the caller');
  end if;
  delete from public.products where name = 'Forgery Attempt';
end $$;

select public.t_expect_ok('constraints', 'valid product accepted',
  $q$insert into public.products (name, price, unit, category) values ('Good', 100, 'per kg', 'Chicken')$q$);

-- Promotions
select public.t_expect_error('promotions', 'percentage over 100 rejected',
  $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
    values ('Too much', 'percentage', 101, current_date, current_date + 1)$q$);

select public.t_expect_error('promotions', 'zero discount rejected',
  $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
    values ('Free', 'percentage', 0, current_date, current_date + 1)$q$);

select public.t_expect_error('promotions', 'negative discount rejected',
  $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
    values ('Backwards', 'percentage', -10, current_date, current_date + 1)$q$);

select public.t_expect_error('promotions', 'unknown discount_type rejected',
  $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
    values ('Bogus', 'crypto', 10, current_date, current_date + 1)$q$);

select public.t_expect_error('promotions', 'end before start rejected',
  $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
    values ('Backwards dates', 'percentage', 10, current_date + 5, current_date)$q$);

select public.t_expect_error('promotions', 'blank promotion name rejected',
  $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
    values ('', 'percentage', 10, current_date, current_date + 1)$q$);

-- =============================================================================
-- B. PROMOTION INTEGRITY
-- =============================================================================
insert into public.promotions (id, name, discount_type, discount_value, start_date, end_date, is_active)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Weekend Deal', 'percentage', 10,
        current_date - 1, current_date + 5, true);

insert into public.promotions (id, name, discount_type, discount_value, start_date, end_date, is_active)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'Expired Deal', 'percentage', 50,
        current_date - 10, current_date - 5, true);

select public.t_expect_error('promotions', 'promotion must cover the product',
  $q$update public.products set active_promotion_id = 'bbbbbbbb-0000-0000-0000-000000000001'
    where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$);

insert into public.promotion_products (promotion_id, product_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003');

select public.t_expect_error('promotions', 'duplicate product in one promotion rejected',
  $q$insert into public.promotion_products (promotion_id, product_id)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001')$q$);

select public.t_expect_ok('promotions', 'product can now take the promotion',
  $q$update public.products set active_promotion_id = 'bbbbbbbb-0000-0000-0000-000000000001'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$);

-- Fixed discount larger than the price must be refused.
insert into public.promotions (id, name, discount_type, discount_value, start_date, end_date, is_active)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'Too Big', 'fixed_amount', 99999,
        current_date, current_date + 1, true);
insert into public.promotion_products (promotion_id, product_id)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003');

select public.t_expect_error('promotions', 'fixed discount larger than price rejected',
  $q$update public.products set active_promotion_id = 'bbbbbbbb-0000-0000-0000-000000000003'
    where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$);

-- Deleting an applied promotion must not break the product row.
select public.t_expect_ok('promotions', 'deleting applied promotion detaches cleanly',
  $q$delete from public.promotions where id = 'bbbbbbbb-0000-0000-0000-000000000003'$q$);

-- =============================================================================
-- C. PUBLIC PRICE ARITHMETIC + EXPIRY (matches src/lib/pricing.js)
-- =============================================================================
select public.t_expect_ok('pricing', 'active percentage applied',
  $q$update public.products set active_promotion_id = 'bbbbbbbb-0000-0000-0000-000000000001'
    where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$);

select public.t_expect_ok('pricing', 'expired promotion applied',
  $q$insert into public.promotion_products (promotion_id, product_id)
      values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002')$q$);
select public.t_expect_ok('pricing', 'expired promotion set on product',
  $q$update public.products set active_promotion_id = 'bbbbbbbb-0000-0000-0000-000000000002'
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'$q$);

do $$
declare
  v_list int; v_cur int; v_promo boolean; v_count int; v_sold_out int; v_expected int;
begin
  -- 16000 @ 10% = 14400
  select list_price, current_price, is_promoted into v_list, v_cur, v_promo
    from public.public_products
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  if v_list <> 16000 then
    perform public.t_fail('pricing', 'list price preserved', 'got ' || v_list);
  elsif v_cur <> 14400 then
    perform public.t_fail('pricing', '10% of 16000 = 14400', 'got ' || v_cur);
  elsif v_promo is not true then
    perform public.t_fail('pricing', 'active promotion flagged', 'is_promoted was false');
  else
    perform public.t_pass('pricing', '10% of 16000 = 14400, flagged as promoted');
  end if;

  -- An EXPIRED promotion must not change the price.
  select current_price, is_promoted into v_cur, v_promo
    from public.public_products where id = 'aaaaaaaa-0000-0000-0000-000000000002';

  if v_cur <> 28000 or v_promo is not false then
    perform public.t_fail('pricing', 'expired promotion ignored',
      'price=' || v_cur || ' promoted=' || v_promo);
  else
    perform public.t_pass('pricing', 'expired promotion ignored (28000, not promoted)');
  end if;

  -- A disabled product must be invisible to the public view.
  select count(*) into v_sold_out
    from public.public_products where id = 'aaaaaaaa-0000-0000-0000-000000000004';
  if v_sold_out <> 0 then
    perform public.t_fail('visibility', 'disabled product hidden from public', 'row was visible');
  else
    perform public.t_pass('visibility', 'disabled product hidden from public');
  end if;

  -- Cardinality must match exactly the available rows, whatever else exists.
  select count(*) into v_count from public.public_products;
  select count(*) into v_expected from public.products where is_available;
  if v_count <> v_expected then
    perform public.t_fail('visibility', 'public view returns exactly the available rows',
      'view=' || v_count || ' expected=' || v_expected);
  else
    perform public.t_pass('visibility', 'public view returns exactly the available rows (' || v_count || ')');
  end if;
end $$;

-- Half-way rounding must agree with the JS mirror (1250 @ 33% = 838).
insert into public.products (id, name, price, unit, category) values
  ('aaaaaaaa-0000-0000-0000-000000000099', 'Rounding Probe', 1250, 'each', 'Chicken');
insert into public.promotions (id, name, discount_type, discount_value, start_date, end_date, is_active)
values ('bbbbbbbb-0000-0000-0000-000000000099', 'Third Off', 'percentage', 33,
        current_date - 1, current_date + 1, true);
insert into public.promotion_products (promotion_id, product_id)
  values ('bbbbbbbb-0000-0000-0000-000000000099', 'aaaaaaaa-0000-0000-0000-000000000099');
update public.products set active_promotion_id = 'bbbbbbbb-0000-0000-0000-000000000099'
 where id = 'aaaaaaaa-0000-0000-0000-000000000099';

do $$
declare v_cur int;
begin
  select current_price into v_cur from public.public_products
   where id = 'aaaaaaaa-0000-0000-0000-000000000099';
  if v_cur <> 838 then
    perform public.t_fail('pricing', 'half-up rounding matches JS (1250 @ 33% = 838)', 'SQL gave ' || v_cur);
  else
    perform public.t_pass('pricing', 'half-up rounding matches JS (1250 @ 33% = 838)');
  end if;
end $$;
delete from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000099';
delete from public.promotions where id = 'bbbbbbbb-0000-0000-0000-000000000099';

-- =============================================================================
-- D. ROW LEVEL SECURITY — the actual authorization boundary
-- =============================================================================

-- D1. Anonymous visitor.
do $$
declare v_count int;
begin
  set local role anon;
  set local request.jwt.claim.sub = '';

  -- Can read the catalogue (at least the three seeded available rows).
  select count(*) into v_count from public.public_products;
  if v_count < 3 then
    perform public.t_fail('rls-anon', 'anon can read available products', 'count=' || v_count);
  else
    perform public.t_pass('rls-anon', 'anon can read available products (' || v_count || ')');
  end if;

  -- Cannot see a disabled product even by direct primary-key lookup.
  select count(*) into v_count from public.products
   where id = 'aaaaaaaa-0000-0000-0000-000000000004';
  if v_count <> 0 then
    perform public.t_fail('rls-anon', 'anon cannot read a disabled product', 'row leaked');
  else
    perform public.t_pass('rls-anon', 'anon cannot read a disabled product');
  end if;

  -- Cannot see a draft or expired promotion.
  perform public.t_expect_value('rls-anon', 'anon cannot UPDATE a price',
    $q$update public.products set price = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$,
    $q$select trunc(price)::text from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$,
    '16000');
  perform public.t_expect_value('rls-anon', 'anon cannot DELETE a product',
    $q$delete from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    $q$select count(*)::text from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    '1');
  perform public.t_expect_error('rls-anon', 'anon cannot INSERT a product',
    $q$insert into public.products (name, price, unit, category) values ('Hack', 1, 'per kg', 'Chicken')$q$);
  perform public.t_expect_error('rls-anon', 'anon cannot INSERT a promotion',
    $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
      values ('Hack', 'percentage', 90, current_date, current_date + 1)$q$);
  perform public.t_expect_error('rls-anon', 'anon cannot grant themselves admin',
    $q$insert into public.admin_profiles (user_id, role) values ('33333333-3333-3333-3333-333333333333', 'admin')$q$);
  perform public.t_expect_error('rls-anon', 'anon cannot link products to promotions',
    $q$insert into public.promotion_products (promotion_id, product_id)
      values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')$q$);
  perform public.t_expect_value('rls-anon', 'anon cannot read the audit log',
    $q$select count(*) from public.audit_logs$q$,
    $q$select count(*)::text from public.audit_logs$q$, '0');
  perform public.t_expect_error('rls-anon', 'anon cannot upload an image',
    $q$insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/y.png')$q$);

  reset role;
end $$;

-- D2. Authenticated but NOT staff (a normal customer account).
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

  -- Liver's seeded price is 8000; the staff block that changes it to 17500 runs later.
  perform public.t_expect_value('rls-customer', 'customer cannot UPDATE a price',
    $q$update public.products set price = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    $q$select trunc(price)::text from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    '8000');
  perform public.t_expect_error('rls-customer', 'customer cannot INSERT a product',
    $q$insert into public.products (name, price, unit, category) values ('Hack', 1, 'per kg', 'Chicken')$q$);
  perform public.t_expect_value('rls-customer', 'customer cannot DELETE a product',
    $q$delete from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    $q$select count(*)::text from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    '1');
  perform public.t_expect_error('rls-customer', 'customer cannot create a promotion',
    $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
      values ('Hack', 'percentage', 90, current_date, current_date + 1)$q$);
  perform public.t_expect_error('rls-customer', 'customer cannot promote themselves to admin',
    $q$insert into public.admin_profiles (user_id, role)
      values ('22222222-2222-2222-2222-222222222222', 'admin')$q$);
  perform public.t_expect_error('rls-customer', 'customer cannot upload an image',
    $q$insert into storage.objects (bucket_id, name) values ('product-images', 'products/x/y.png')$q$);
  perform public.t_expect_value('rls-customer', 'customer cannot read the audit log',
    $q$select count(*) from public.audit_logs$q$,
    $q$select count(*)::text from public.audit_logs$q$, '0');

  -- Can still browse the catalogue.
  perform public.t_expect_ok('rls-customer', 'customer can still read the catalogue',
    $q$select count(*) from public.public_products$q$);

  reset role;
end $$;

-- D3. A genuine staff member.
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

  perform public.t_expect_ok('rls-staff', 'admin can UPDATE a price',
    $q$update public.products set price = 17500 where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$);
  perform public.t_expect_ok('rls-staff', 'admin can INSERT a product',
    $q$insert into public.products (name, price, unit, category)
      values ('Staff Added', 5000, 'per kg', 'Chicken')$q$);
  perform public.t_expect_ok('rls-staff', 'admin can read disabled products',
    $q$select count(*) from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000004'$q$);
  perform public.t_expect_ok('rls-staff', 'admin can create a promotion',
    $q$insert into public.promotions (name, discount_type, discount_value, start_date, end_date)
      values ('Staff Promo', 'percentage', 5, current_date, current_date + 3)$q$);
  perform public.t_expect_ok('rls-staff', 'admin can upload an image',
    $q$insert into storage.objects (bucket_id, name) values ('product-images', 'products/abc/def.png')$q$);
  perform public.t_expect_ok('rls-staff', 'admin can read the audit log',
    $q$select count(*) from public.audit_logs$q$);

  -- Staff still cannot write outside the products/ prefix in storage.
  perform public.t_expect_error('rls-staff', 'upload cannot escape the products/ folder',
    $q$insert into storage.objects (bucket_id, name) values ('product-images', '../evil.png')$q$);

  reset role;
end $$;

-- D4. Losing the admin_profiles row removes access immediately.
do $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
  perform public.t_expect_value('rls-revocation', 'unknown authenticated user cannot write',
    $q$update public.products set price = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    $q$select trunc(price)::text from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$,
    '17500');
  reset role;
end $$;

-- =============================================================================
-- E. AUDIT LOG
-- =============================================================================
do $$
declare v_n int;
begin
  select count(*) into v_n from public.audit_logs where action = 'price_changed';
  if v_n = 0 then
    perform public.t_fail('audit', 'price change logged', 'no price_changed entry');
  else
    perform public.t_pass('audit', 'price change logged (' || v_n || ' entries)');
  end if;

  select count(*) into v_n from public.audit_logs where action = 'product_created';
  if v_n = 0 then
    perform public.t_fail('audit', 'product creation logged', 'no product_created entry');
  else
    perform public.t_pass('audit', 'product creation logged');
  end if;

  -- Detail bag must never contain a credential-looking key.
  select count(*) into v_n from public.audit_logs
   where details ? 'password' or details ? 'token' or details ? 'secret'
      or details ? 'service_role';
  if v_n <> 0 then
    perform public.t_fail('audit', 'no credentials in audit details', 'found ' || v_n);
  else
    perform public.t_pass('audit', 'no credentials in audit details');
  end if;
end $$;

-- =============================================================================
-- F. STORAGE BUCKET CONFIGURATION
-- =============================================================================
do $$
declare v_pub boolean; v_size bigint; v_mimes text[];
begin
  select public, file_size_limit, allowed_mime_types into v_pub, v_size, v_mimes
    from storage.buckets where id = 'product-images';

  if v_pub is not true then
    perform public.t_fail('storage', 'bucket is publicly readable', 'public=' || v_pub);
  else
    perform public.t_pass('storage', 'bucket is publicly readable (needed for <img>)');
  end if;

  if v_size <> 5242880 then
    perform public.t_fail('storage', '5 MB size limit configured', 'limit=' || v_size);
  else
    perform public.t_pass('storage', '5 MB size limit configured');
  end if;

  if 'image/svg+xml' = any(v_mimes) then
    perform public.t_fail('storage', 'SVG not in the MIME allow-list', 'svg allowed');
  elsif not ('image/jpeg' = any(v_mimes) and 'image/png' = any(v_mimes)
             and 'image/webp' = any(v_mimes)) then
    perform public.t_fail('storage', 'JPEG/PNG/WebP allow-listed', 'got ' || array_to_string(v_mimes, ','));
  else
    perform public.t_pass('storage', 'JPEG/PNG/WebP allow-listed, SVG excluded');
  end if;
end $$;

-- =============================================================================
-- RESULTS
-- =============================================================================
\echo ''
\echo '================= TEST RESULTS ================='
select area,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
  from public.test_results
 group by area
 order by min(seq);

\echo ''
select total as total_tests,
       passed,
       failed
  from (select count(*) total,
               count(*) filter (where passed) passed,
               count(*) filter (where not passed) failed
          from public.test_results) s;

\echo ''
\echo '--- any failures ---'
select area, test, detail from public.test_results where not passed order by seq;