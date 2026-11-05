-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.songs (
  id text NOT NULL,
  title text NOT NULL,
  artist_id text NOT NULL,
  artist_name text NOT NULL,
  album_id text,
  duration_ms bigint NOT NULL,
  stream_url text NOT NULL,
  artwork_url text,
  genre text,
  release_date text,
  play_count integer DEFAULT 0,
  valence double precision DEFAULT 0.5,
  energy double precision DEFAULT 0.5,
  CONSTRAINT songs_pkey PRIMARY KEY (id),
  CONSTRAINT songs_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id)
);
CREATE TABLE public.artists (
  id text NOT NULL,
  name text NOT NULL,
  bio text,
  image_url text,
  is_verified boolean DEFAULT false,
  follower_count integer DEFAULT 0,
  monthly_listeners integer NOT NULL DEFAULT 0,
  CONSTRAINT artists_pkey PRIMARY KEY (id)
);
CREATE TABLE public.albums (
  id text NOT NULL,
  title text NOT NULL,
  artist_id text NOT NULL,
  artwork_url text,
  song_ids ARRAY DEFAULT '{}'::text[],
  release_date text,
  CONSTRAINT albums_pkey PRIMARY KEY (id)
);
CREATE TABLE public.playlists (
  id text NOT NULL,
  title text NOT NULL,
  owner_id text NOT NULL,
  song_ids ARRAY DEFAULT '{}'::text[],
  is_public boolean DEFAULT false,
  cover_color_hex text,
  CONSTRAINT playlists_pkey PRIMARY KEY (id)
);
CREATE TABLE public.atmosphere_profiles (
  song_id text NOT NULL,
  profile_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT atmosphere_profiles_pkey PRIMARY KEY (song_id),
  CONSTRAINT atmosphere_profiles_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id)
);
CREATE TABLE public.lyrics_cache (
  song_id text NOT NULL,
  lyrics_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lyrics_cache_pkey PRIMARY KEY (song_id),
  CONSTRAINT lyrics_cache_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id)
);
CREATE TABLE public.liked_songs (
  user_id text NOT NULL,
  song_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT liked_songs_pkey PRIMARY KEY (user_id, song_id),
  CONSTRAINT liked_songs_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id)
);
CREATE TABLE public.listening_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id text NOT NULL,
  song_id text NOT NULL,
  played_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT listening_history_pkey PRIMARY KEY (id),
  CONSTRAINT listening_history_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id)
);
CREATE TABLE public.music_worlds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  song_id text,
  atmosphere_profile jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT music_worlds_pkey PRIMARY KEY (id),
  CONSTRAINT music_worlds_song_id_fkey FOREIGN KEY (song_id) REFERENCES public.songs(id)
);
CREATE TABLE public.artist_follows (
  user_id text NOT NULL,
  artist_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT artist_follows_pkey PRIMARY KEY (user_id, artist_id),
  CONSTRAINT artist_follows_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id)
);
CREATE TABLE public.user_profiles (
  user_id text NOT NULL,
  display_name text,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id)
);