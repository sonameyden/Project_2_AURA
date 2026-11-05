-- AURA artist follows and genre recommendations migration
-- Run once in the Supabase SQL editor after the base schema.

create table if not exists artist_follows (
  user_id text not null,
  artist_id text not null references artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index if not exists artist_follows_artist_id_idx
  on artist_follows (artist_id);

create index if not exists artist_follows_user_created_at_idx
  on artist_follows (user_id, created_at desc);

create or replace function update_artist_follower_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update artists
    set follower_count = follower_count + 1
    where id = new.artist_id;
    return new;
  end if;

  update artists
  set follower_count = greatest(follower_count - 1, 0)
  where id = old.artist_id;
  return old;
end;
$$;

drop trigger if exists artist_follows_count_trigger on artist_follows;

create trigger artist_follows_count_trigger
after insert or delete on artist_follows
for each row
execute function update_artist_follower_count();

-- Reconcile counts in case artists already had followers before this migration.
update artists
set follower_count = (
  select count(*)::int
  from artist_follows
  where artist_follows.artist_id = artists.id
);
