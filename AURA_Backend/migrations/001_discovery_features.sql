-- Project II · Phase 2: natural-language search + personalised recommendations.
-- Safe to run more than once. Run in the Supabase SQL editor after the earlier
-- supabase_*_migration.sql files.

-- 1. Searchable song features ------------------------------------------------
alter table songs add column if not exists mood_tags text[] not null default '{}';
alter table songs add column if not exists activity_tags text[] not null default '{}';
-- 'default' = valence/energy are the 0.5 placeholders; 'atmosphere' = copied
-- from a generated AtmosphereProfile; 'manual' = set by hand.
alter table songs add column if not exists features_source text not null default 'default';

create index if not exists songs_mood_tags_idx on songs using gin (mood_tags);
create index if not exists songs_activity_tags_idx on songs using gin (activity_tags);
create index if not exists songs_genre_idx on songs (lower(genre));

-- 2. Backfill from atmosphere profiles that were already generated -----------
update songs s
set
  energy = least(1, greatest(0, (ap.profile_json->>'energy')::double precision)),
  valence = least(1, greatest(0, (ap.profile_json->>'valence')::double precision)),
  mood_tags = (
    select coalesce(array_agg(distinct word), '{}')
    from (
      select unnest(regexp_split_to_array(lower(coalesce(ap.profile_json->>'emotion', '')), '[^a-z]+')) as word
      union all
      select unnest(case ap.profile_json->>'environment'
        when 'Heaven' then array['peaceful', 'uplifting']
        when 'Nature' then array['calm', 'organic']
        when 'Ocean' then array['calm', 'flowing']
        when 'Dream' then array['dreamy', 'ethereal']
        when 'Romantic' then array['romantic', 'warm']
        when 'Melancholic' then array['sad', 'melancholic']
        when 'Hopeful' then array['hopeful', 'uplifting']
        when 'Energetic' then array['energetic', 'intense']
        else array[]::text[]
      end)
    ) words
    where length(word) > 2
  ),
  activity_tags = case
    when (ap.profile_json->>'energy')::double precision < 0.3 then array['sleep', 'relax', 'study']
    when (ap.profile_json->>'energy')::double precision < 0.55 then array['study', 'focus', 'relax']
    when (ap.profile_json->>'energy')::double precision < 0.75 then array['driving', 'walking', 'cooking']
    else array['workout', 'party']
  end,
  features_source = 'atmosphere'
from atmosphere_profiles ap
where ap.song_id = s.id
  and s.features_source = 'default'
  and ap.profile_json ? 'energy'
  and ap.profile_json ? 'valence';

-- 3. Cache for interpreted search queries -------------------------------------
-- Keyed by SHA-256 of the normalised query so repeat searches never re-call OpenAI.
create table if not exists nl_search_cache (
  query_hash text primary key,
  query text not null,
  interpretation jsonb not null,
  created_at timestamptz not null default now()
);

-- Only the Worker (service role) touches these tables.
alter table nl_search_cache enable row level security;
