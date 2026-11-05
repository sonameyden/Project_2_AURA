-- AURA artist/song relationship migration
-- Run after supabase_artist_follows_migration.sql.
-- This safely repairs existing orphaned song artist IDs before adding the foreign key.

insert into artists (id, name, bio, is_verified)
select distinct
  songs.artist_id,
  coalesce(nullif(songs.artist_name, ''), 'Unknown Artist'),
  null,
  false
from songs
left join artists on artists.id = songs.artist_id
where artists.id is null
on conflict (id) do nothing;

create index if not exists songs_artist_id_idx
  on songs (artist_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'songs_artist_id_fkey'
      and conrelid = 'songs'::regclass
  ) then
    alter table songs
      add constraint songs_artist_id_fkey
      foreign key (artist_id)
      references artists(id)
      on update cascade
      on delete restrict;
  end if;
end;
$$;
