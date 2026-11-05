-- AURA user profile migration
-- Run this once in the Supabase SQL editor after the existing migrations.
-- The Worker uses the service-role key for these records.

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

create table if not exists user_profiles (
  user_id text primary key,
  display_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
