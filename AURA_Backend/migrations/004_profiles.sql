-- Project II · Phase 5: user and artist profile upgrades. Safe to run more than once.

alter table user_profiles add column if not exists bio text;
-- When false, other people don't see this user's recent listening or top genres.
alter table user_profiles add column if not exists show_listening boolean not null default true;

-- Speeds up "likes across an artist's songs" for the artist stats card.
create index if not exists liked_songs_song_id_idx on liked_songs (song_id);
