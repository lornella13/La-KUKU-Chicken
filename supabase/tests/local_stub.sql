-- Minimal stand-in for the Supabase-managed objects the migrations depend on.
-- Creates the `auth` schema with a `users` table and an `auth.uid()` function,
-- plus the `anon` / `authenticated` roles and a minimal `storage` schema.
-- This exists ONLY so the project migrations can be executed and tested on a
-- plain PostgreSQL server. It is not part of the application.

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

-- Supabase exposes auth.uid() as the user id from the JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

-- Minimal storage schema: enough for the bucket + object policies to be created
-- and exercised. Supabase's real storage.objects has more columns; these are
-- the ones the policies touch.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null
);

alter table storage.objects enable row level security;

-- Supabase's helper: splits an object name into path segments.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;

grant execute on function storage.foldername(text) to anon, authenticated;
grant usage on schema storage to anon, authenticated;
