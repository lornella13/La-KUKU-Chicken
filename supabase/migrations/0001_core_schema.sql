-- =============================================================================
-- La Kuku Chicken — 0001: core schema
--
-- Tables: products, promotions, promotion_products, admin_profiles
--
-- Design notes that matter for correctness:
--
--  * Money is stored as INTEGER Ugandan shillings. UGX is not practically
--    used in minor units, and integers make every calculation exact -- there
--    is no floating point anywhere in the money path.
--
--  * A product has AT MOST ONE promotion applied at a time, via
--    products.active_promotion_id. This is deliberate. If two overlapping
--    promotions could apply to the same product, the displayed price would
--    depend on tie-breaking rules and could change on its own mid-day. One
--    explicit pointer means the price is deterministic and auditable: an
--    admin decides which promotion is live, and the database can prove it.
--
--  * promotion_products records WHICH products a promotion covers (so an admin
--    can tick a set of products when creating it). The single active pointer
--    on products is what actually drives the displayed price.
--
--  * No password is stored anywhere in these tables. Authentication is
--    handled entirely by Supabase Auth (auth.users); admin_profiles only
--    records that a given authenticated user id holds a given role.
-- =============================================================================

-- gen_random_uuid() is core in modern Postgres; kept explicit for clarity.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
--
-- BEFORE INSERT OR UPDATE, not UPDATE alone: on insert it forces the database
-- clock to win, so a caller cannot backdate updated_at by supplying its own
-- value. That matters because the public read view orders on updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),

  name        text        not null,
  description text        not null default '',
  -- Ugandan shillings.
  --
  -- numeric(12,2) is an EXACT decimal type in Postgres, not binary floating
  -- point, so money arithmetic stays exact. An integer column was rejected:
  -- Postgres silently ROUNDS a fractional input (100.5 -> 101) instead of
  -- reporting an error, which would store a price the admin never typed.
  -- Whole shillings are therefore enforced by the CHECK constraint below.
  price       numeric(12,2) not null,
  unit        text        not null default 'per kg',
  category    text        not null,
  image_url   text,

  -- Admin-controlled visibility. Disabled products are hidden from the public
  -- site but are never deleted, so order history stays meaningful.
  is_available boolean     not null default true,

  -- The single promotion applied to this product, if any.
  active_promotion_id uuid,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_name_length      check (char_length(name) <= 120),
  constraint products_description_len  check (char_length(description) <= 2000),
  constraint products_price_not_negative check (price >= 0),
  constraint products_price_sane         check (price <= 1000000000),
  constraint products_price_whole_shillings check (price = trunc(price)),
  constraint products_unit_not_blank    check (length(btrim(unit)) > 0),
  constraint products_category_not_blank check (length(btrim(category)) > 0),
  -- Reject javascript:/data: URLs in image_url. Only http(s) or site-relative
  -- paths are storable, so an admin cannot inject a script URL into an <img>.
  constraint products_image_url_scheme check (
    image_url is null
    or image_url !~* '^\s*(javascript|data|vbscript|file):'
  )
);

comment on column public.products.price is
  'Price in Ugandan shillings. Exact decimal; whole shillings enforced by check.';

create index if not exists products_available_idx
  on public.products (is_available, category);

create trigger products_set_updated_at
  before insert or update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------------
create table if not exists public.promotions (
  id             uuid primary key default gen_random_uuid(),

  name           text        not null,

  -- Restrict to the two supported mechanisms rather than free text.
  discount_type  text        not null,
  discount_value numeric(12,2) not null,

  start_date     date        not null,
  end_date       date        not null,

  is_active      boolean     not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint promotions_name_not_blank check (length(btrim(name)) > 0),
  constraint promotions_name_length      check (char_length(name) <= 120),
  constraint promotions_discount_type_valid
    check (discount_type in ('percentage', 'fixed_amount')),

  -- Value rules depend on the type, and are enforced in the database so they
  -- cannot be bypassed by calling the API directly.
  constraint promotions_discount_value_positive check (discount_value > 0),
  constraint promotions_discount_value_valid check (
    (discount_type = 'percentage'    and discount_value <= 100)
    or
    (discount_type = 'fixed_amount' and discount_value >= 0)
  ),
  constraint promotions_date_order check (end_date >= start_date)
);

create index if not exists promotions_active_window_idx
  on public.promotions (is_active, start_date, end_date);

create trigger promotions_set_updated_at
  before insert or update on public.promotions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- promotion_products  (which products a promotion covers)
-- ---------------------------------------------------------------------------
create table if not exists public.promotion_products (
  promotion_id uuid not null
    references public.promotions(id) on delete cascade,
  product_id   uuid not null
    references public.products(id)   on delete cascade,

  created_at   timestamptz not null default now(),

  -- Prevents the same product being ticked twice into one promotion.
  primary key (promotion_id, product_id)
);

create index if not exists promotion_products_product_idx
  on public.promotion_products (product_id);

-- ---------------------------------------------------------------------------
-- One promotion per product.
--
-- Adds the circular foreign key (products -> promotions) now that promotions
-- exists. ON DELETE SET NULL means deleting a promotion cleanly removes it
-- from any product rather than blocking the delete.
-- ---------------------------------------------------------------------------
alter table public.products
  drop constraint if exists products_active_promotion_fk;

alter table public.products
  add constraint products_active_promotion_fk
  foreign key (active_promotion_id) references public.promotions(id)
  on delete set null;

-- Referential integrity, enforced in the database rather than trusted from the
-- client: a product may only point at a promotion that actually covers it.
create or replace function public.promotion_applies_to_product()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.active_promotion_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.promotion_products pp
    where pp.promotion_id = new.active_promotion_id
      and pp.product_id   = new.id
  ) then
    raise exception
      'Promotion % is not linked to product %; add it to the promotion''s product list first.',
      new.active_promotion_id, new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger products_promotion_must_cover_product
  before insert or update of active_promotion_id on public.products
  for each row execute function public.promotion_applies_to_product();

-- A fixed-amount discount that exceeds the product price would compute a
-- negative price. Clamp to zero in the display view and reject the obviously
-- broken case at write time.
create or replace function public.promotion_fixed_amount_fits()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_price numeric;
begin
  if new.active_promotion_id is null then
    return new;
  end if;

  select p.price into v_price from public.products p where p.id = new.id;

  if exists (
    select 1 from public.promotions pr
    where pr.id = new.active_promotion_id
      and pr.discount_type = 'fixed_amount'
      and pr.discount_value > v_price
  ) then
    raise exception
      'Fixed discount % is greater than the product price %.',
      (select discount_value from public.promotions where id = new.active_promotion_id),
      v_price
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger products_promotion_amount_fits
  before insert or update of active_promotion_id on public.products
  for each row execute function public.promotion_fixed_amount_fits();

-- ---------------------------------------------------------------------------
-- admin_profiles
--
-- No password column, by design. Passwords live in Supabase Auth only.
-- user_id is a primary key keyed to auth.users so a user can hold one role.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text        not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Extensible for future roles. 'admin' is full control; 'manager' is the
  -- intended future day-to-day operator role.
  constraint admin_profiles_role_valid check (role in ('admin', 'manager'))
);

create trigger admin_profiles_set_updated_at
  before insert or update on public.admin_profiles
  for each row execute function public.set_updated_at();
