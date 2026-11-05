-- Project II · Phase 4: playlist sharing and collaboration.
-- Safe to run more than once.

-- 1. Versioning for concurrent edits ------------------------------------------
-- Every change bumps `version`; the Worker writes with `where version = <read
-- version>` and retries on conflict, so two editors adding songs at the same
-- moment both keep their song (last write wins for reorders and renames).
alter table playlists add column if not exists version integer not null default 0;
alter table playlists add column if not exists updated_at timestamptz not null default now();
alter table playlists add column if not exists description text;
alter table playlists add column if not exists created_at timestamptz not null default now();

-- 2. Collaborators --------------------------------------------------------------
create table if not exists playlist_collaborators (
  playlist_id text not null references playlists (id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('viewer', 'editor')),
  invited_by text,
  created_at timestamptz not null default now(),
  primary key (playlist_id, user_id)
);
create index if not exists playlist_collaborators_user_idx on playlist_collaborators (user_id);

-- 3. Invite links ---------------------------------------------------------------
-- A link carries a role. Opening it as another signed-in user adds them as a
-- collaborator with that role. The owner can revoke links.
create table if not exists playlist_invites (
  code text primary key,
  playlist_id text not null references playlists (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked boolean not null default false,
  uses integer not null default 0
);
create index if not exists playlist_invites_playlist_idx on playlist_invites (playlist_id);

-- Only the Worker (service role) reads or writes these tables; clients never
-- connect to Supabase directly, and the Worker checks roles on every request.
alter table playlist_collaborators enable row level security;
alter table playlist_invites enable row level security;
