-- =============================================================================
-- La Kuku Chicken — 0007: map markers
--
-- Stores points of interest for the map widget so the map view can initialize
-- centered on a configured location instead of a hardcoded frontend constant.
-- The public site reads these coordinates to place the primary marker and
-- centre the map on load.
--
-- Design notes:
--   * latitude / longitude are stored as NUMERIC(10,7) — about 1 cm precision,
--     which is more than enough for a map marker and avoids floating-point
--     drift in distance calculations.
--   * is_primary marks the single marker the map should centre on. Only one
--     row may be primary at a time, enforced by a unique partial index.
-- =============================================================================

create table if not exists public.map_markers (
  id          uuid primary key default gen_random_uuid(),

  name        text        not null,
  address     text        not null,
  description text        not null default '',

  latitude    numeric(10,7) not null,
  longitude   numeric(10,7) not null,

  is_primary  boolean     not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint map_markers_name_not_blank     check (length(btrim(name)) > 0),
  constraint map_markers_name_length        check (char_length(name) <= 120),
  constraint map_markers_address_not_blank  check (length(btrim(address)) > 0),
  constraint map_markers_address_length     check (char_length(address) <= 200),
  constraint map_markers_latitude_valid     check (latitude >= -90 and latitude <= 90),
  constraint map_markers_longitude_valid    check (longitude >= -180 and longitude <= 180),
  constraint map_markers_description_length check (char_length(description) <= 500),
);

create index if not exists map_markers_primary_idx
  on public.map_markers (is_primary);

create unique index if not exists map_markers_one_primary
  on public.map_markers (is_primary)
  where is_primary;

create trigger map_markers_set_updated_at
  before insert or update on public.map_markers
  for each row execute function public.set_updated_at();

-- Seed the primary point of interest: Red Sea Specialized Medical Services,
-- located on Mugwanya Road, Kampala / Entebbe region, directly near the
-- La Kuku shop. Coordinates mirror the existing shop neighbourhood so the
-- map view opens on the correct area.
insert into public.map_markers (
  name,
  address,
  description,
  latitude,
  longitude,
  is_primary
)
values
  (
    'Red Sea Specialized Medical Services',
    'Mugwanya Road, Kampala / Entebbe region, Uganda',
    'Medical centre located directly near the La Kuku shop on Mugwanya Road.',
    0.3050300,
    32.5498900,
    true
  )
on conflict do nothing;

-- Public read view so the website can fetch marker coordinates without
-- exposing write access.
create or replace view public.public_map_markers
with (security_invoker = true)
as
select
  id,
  name,
  address,
  description,
  latitude,
  longitude,
  is_primary
from public.map_markers;

grant select on public.map_markers to anon, authenticated;
grant select on public.public_map_markers to anon, authenticated;

-- =============================================================================
-- Helper: returns the single primary map marker for the map widget to centre on.
-- =============================================================================
create or replace function public.get_primary_map_marker()
returns table (
  id          uuid,
  name        text,
  address     text,
  description text,
  latitude    numeric(10,7),
  longitude   numeric(10,7)
)
language sql
set search_path = public, pg_temp
as $$
  select
    id,
    name,
    address,
    description,
    latitude,
    longitude
  from public.map_markers
  where is_primary
  limit 1;
$$;

grant execute on function public.get_primary_map_marker() to anon, authenticated;

-- =============================================================================
-- Row Level Security — map markers are readable by everyone, writable only by
-- admins (same pattern as products).
-- =============================================================================

alter table public.map_markers enable row level security;

create policy map_markers_select_all
  on public.map_markers
  for select
  to anon, authenticated
  using (true);

create policy map_markers_insert_admin
  on public.map_markers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy map_markers_update_admin
  on public.map_markers
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy map_markers_delete_admin
  on public.map_markers
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );
