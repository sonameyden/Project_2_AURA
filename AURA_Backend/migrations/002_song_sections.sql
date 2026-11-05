-- Project II · Phase 3: section-based dynamic visuals.
-- Stores the AI-generated section timeline per song (Intro/Verse/Chorus/...,
-- each with its own palette, lighting, environment and cat behaviour).
-- Until a row exists the Worker serves an estimated timeline and generates
-- this one in the background. Safe to run more than once.

create table if not exists song_sections (
  song_id text primary key references songs (id) on delete cascade,
  sections_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table song_sections enable row level security;

-- To regenerate a song's timeline (e.g. after editing lyrics), delete its row:
--   delete from song_sections where song_id = '<song id>';
