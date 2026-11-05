-- Run this in Supabase's SQL editor before deploying the Worker.
-- Matches the row shapes assumed in src/routes/*.ts and src/lib/supabase.ts.

create table if not exists songs (
  id text primary key,
  title text not null,
  artist_id text not null,
  artist_name text not null,
  album_id text,
  duration_ms bigint not null,
  stream_url text not null,       -- your R2 public/streaming URL
  artwork_url text,
  genre text,
  release_date text,
  play_count int default 0,
  valence float default 0.5,      -- 0..1, used by /atmosphere/mood matching
  energy float default 0.5        -- 0..1, used by /atmosphere/mood matching
);

create table if not exists artists (
  id text primary key,
  name text not null,
  bio text,
  image_url text,
  is_verified boolean default false,
  follower_count int default 0
);

create table if not exists albums (
  id text primary key,
  title text not null,
  artist_id text not null,
  artwork_url text,
  song_ids text[] default '{}',
  release_date text
);

create table if not exists playlists (
  id text primary key,
  title text not null,
  owner_id text not null,
  song_ids text[] default '{}',
  is_public boolean default false,
  cover_color_hex text
);

-- Cache tables — written to automatically by the Worker, you don't insert into these by hand.
create table if not exists atmosphere_profiles (
  song_id text primary key references songs(id),
  profile_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists lyrics_cache (
  song_id text primary key references songs(id),
  lyrics_json jsonb not null,
  created_at timestamptz default now()
);

-- Seed a couple of test rows so you can hit the API immediately.
-- Replace stream_url with a real royalty-free track's R2 URL once your bucket is set up.
insert into songs (id, title, artist_id, artist_name, duration_ms, stream_url, genre, valence, energy)
values
  ('seed-1', 'Test Track One', 'artist-seed-1', 'Seed Artist', 180000, 'https://example-r2-url/test1.mp3', 'ambient', 0.3, 0.2),
  ('seed-2', 'Test Track Two', 'artist-seed-1', 'Seed Artist', 200000, 'https://example-r2-url/test2.mp3', 'pop', 0.8, 0.7)
on conflict (id) do nothing;
