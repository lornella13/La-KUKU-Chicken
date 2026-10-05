-- =============================================================================
-- La Kuku Chicken — 0005: product size variants
--
-- The existing website sells several products in more than one size (for
-- example Chicken Wings in 500g and 1kg), and renders them as ONE card with a
-- row of size buttons. The database has to carry that structure or the public
-- site would show 18 separate cards instead of 15.
--
-- So: one row per size, and the card is rebuilt by grouping rows on
-- (category, name). This preserves the existing design exactly, including the
-- size buttons, while keeping a single flat table that admins can edit.
--
-- Both columns are optional:
--   variant_label  the size text shown on the button, e.g. "500g". NULL means
--                  this row is a standalone product with no size choice.
--   sort_order     position within its group. Without it, sizes are ordered by
--                  price so the smallest always comes first, matching the
--                  current behaviour.
-- =============================================================================

alter table public.products
  add column if not exists variant_label text;

alter table public.products
  add column if not exists sort_order integer;

alter table public.products
  drop constraint if exists products_variant_label_sane;

alter table public.products
  add constraint products_variant_label_sane check (
    variant_label is null
    or length(btrim(variant_label)) <= 20
  );

-- Products that share a name and category are variants of one another.
-- Unique per (category, name, variant_label) so the same size cannot be added
-- twice; NULL variant_label is excluded from the constraint because in SQL
-- NULLs are never equal to each other.
create unique index if not exists products_variant_unique
  on public.products (category, name, variant_label)
  where variant_label is not null;

create index if not exists products_group_idx
  on public.products (category, name, sort_order);

-- Surface the new columns on the public read view.
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
  p.variant_label,
  p.sort_order,

  p.price                                  as list_price,

  pr.id                                    as promotion_id,
  pr.name                                  as promotion_name,
  pr.discount_type,
  pr.discount_value,
  pr.end_date                              as promotion_end_date,

  (pr.id is not null)                      as is_promoted,

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
 and current_date between pr.start_date and pr.end_date
where p.is_available;

grant select on public.public_products to anon, authenticated;