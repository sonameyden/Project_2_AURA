# AURA Backend — Phase 2 (Cloudflare Workers)

Implements the exact endpoints the Android app's `CatalogApi`, `AtmosphereApi`,
and `LyricsApi` Retrofit interfaces call. This is a **separate project** from
the Android app — it lives in its own folder, gets deployed independently,
and the Android app only ever knows its public URL.

Holds every secret (OpenAI key, Supabase service role key, Genius token) —
none of these are ever embedded in the Android app itself.

## Setup

1. **Install dependencies**
   ```
   cd AURA_Backend
   npm install
   ```

2. **Create a Cloudflare account + install Wrangler** (already a devDependency, but you need a Cloudflare login):
   ```
   npx wrangler login
   ```

3. **Set up Supabase** (this covers both your database AND your audio file storage — one project, no separate R2 account needed)
   - Create a free project at supabase.com (no credit card required)
   - Run `supabase_schema.sql` in the Supabase SQL editor — this creates your tables AND a public `audio` Storage bucket in one go
   - If the earlier schema and library migrations are already installed, run `supabase_music_platform_migration.sql` once — it adds search history and catalog indexes without replacing existing data
   - Grab your Project URL and `service_role` key (Project Settings → API) — **not** the `anon` key, the Worker needs the service role key to bypass RLS
   - Add the Firebase Web API key as the Worker secret `FIREBASE_WEB_API_KEY`; the account deletion endpoint uses it to delete the authenticated Firebase identity
   - Upload a couple of royalty-free test tracks: Storage → `audio` bucket → Upload file, then update the `stream_url` values in `songs` to match (the schema file shows you the exact URL format)

4. **Get a Genius API token** (free) at genius.com/api-clients — used for lyrics lookup

5. **Get your OpenAI API key** — you already have this

6. **Get your Firebase Project ID** — Firebase console → Project Settings → General → "Project ID" (NOT the same as the API key; it's a short string like `aura-app-12345`). This project's every route now requires a valid Firebase ID token, verified against Firebase's public JWKS — no Firebase Admin SDK needed, since that's not Workers-compatible.

7. **Local dev secrets**: copy `.dev.vars.example` to `.dev.vars` and fill in real values:
   ```
   cp .dev.vars.example .dev.vars
   ```
   (`.dev.vars` is gitignored — never commit it)

8. **Run locally**
   ```
   npm run dev
   ```
   This starts the Worker on `http://localhost:8787`. Every route except `/` now requires a Bearer token, so plain `curl` calls will 401 unless you pass a real Firebase ID token:
   ```
   curl http://localhost:8787/
   curl http://localhost:8787/catalog/trending -H "Authorization: Bearer <a real Firebase ID token>"
   ```
   Easiest way to get a real token to test with: log into the Android app once auth is wired up, then temporarily log the token from `AuthRepository.getIdToken()` (remove the log line before committing — never leave tokens in logs, per the best-practices doc).

9. **Deploy for real**
   ```
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put GENIUS_API_KEY
   npx wrangler secret put FIREBASE_PROJECT_ID
   npx wrangler secret put FIREBASE_WEB_API_KEY
   npm run deploy
   ```
   Wrangler prints your deployed URL, something like `https://aura-backend.<your-subdomain>.workers.dev`.

## Connect this to the Android app

In the Android project, open:
`core/data/src/main/java/com/aura/core/data/di/NetworkModule.kt`

Replace:
```kotlin
private const val BASE_URL = "https://api.aura-app.example.com/"
```
with your real deployed Worker URL (include the trailing slash):
```kotlin
private const val BASE_URL = "https://aura-backend.<your-subdomain>.workers.dev/"
```

Rebuild the Android app — Home/Search/Now Playing should now return real data
(assuming you've seeded `songs` in Supabase — `supabase_schema.sql` inserts
two placeholder rows to get you started; update `stream_url` on those or add
your own once you've uploaded royalty-free tracks to R2).

## Endpoint map

| Route | Android caller | What it does |
|---|---|---|
| `GET /catalog/songs/:id` | `CatalogApi.getSong` | Fetch one song from Supabase |
| `POST /catalog/songs/upload` | Artist upload client | Upload multipart `file` audio and optional `artwork` image; optional `albumId` uploads the song directly into an owned album |
| `GET /catalog/artists/:id/songs` | Artist/profile client | List songs belonging to an artist |
| `DELETE /catalog/songs/:id` | Artist client | Delete one of the signed-in artist's songs and its files |
| `DELETE /catalog/albums/:id` | Artist client | Delete an owned album, all associated songs, their records, and their storage files |
| `DELETE /catalog/artists/me` | Artist client | Delete the artist profile, all owned albums/songs, related records, and storage files while preserving the user account |
| `GET /catalog/artists/me` | Artist client | Fetch the signed-in user's artist profile |
| `GET /catalog/artists` | Home client | List artists for discovery |
| `POST /catalog/artists/:id/follow` | Artist profile client | Follow an artist for the signed-in user |
| `DELETE /catalog/artists/:id/follow` | Artist profile client | Unfollow an artist |
| `GET /catalog/artists/:id/following` | Artist profile client | Check whether the signed-in user follows an artist |
| `GET /catalog/artists/following` | Library/profile client | List artists followed by the signed-in user |
| `GET /catalog/artists/:id/followers` | Artist/profile client | Return an artist's current follower count |
| `GET /catalog/artists/me/songs` | Artist client | List the signed-in artist's songs |
| `POST /catalog/songs/:id/artwork` | Artist client | Replace a song's artwork using multipart field `artwork` |
| `POST /catalog/artists/me` | Artist client | Create or update the signed-in user's artist profile |
| `POST /catalog/artists/me/profile-image` | Artist client | Upload a profile image as multipart field `file` |
| `GET /catalog/songs/search?q=` | `CatalogApi.searchSongs` | ilike search on title/artist |
| `GET /catalog/search?q=` | Search client | Unified search response containing `songs`, `artists`, `albums`, and public `playlists` |
| `GET /catalog/albums?artistId=` | Catalog client | Browse albums, optionally filtered to one artist |
| `GET /catalog/albums/mine` | Artist client | List only albums owned by the authenticated artist; use this for the artist dashboard |
| `GET /catalog/albums/search?q=` | Catalog client | Search albums by title |
| `GET /catalog/albums/:id/songs` | Catalog client | Return an album's songs in album order |
| `POST /catalog/albums` | Artist client | Create an album with multipart `title`, optional `releaseDate`, and optional `artwork` image |
| `POST /catalog/albums/:id/artwork` | Artist client | Replace an album's artwork using multipart field `artwork` |
| `POST /catalog/albums/:id/songs` | Artist client | Add one `songId` or multiple `songIds` owned by the signed-in artist |
| `DELETE /catalog/albums/:id/songs/:songId` | Artist client | Remove a song from an album and clear its `albumId` |
| `GET /catalog/genres` | Browse client | Return the distinct genres currently present in songs |
| `GET /catalog/genres/:genre/songs` | Browse client | Browse songs in one genre |
| `GET /catalog/playlists` | Browse client | Browse public playlists |
| `GET /catalog/artists/:id` | `CatalogApi.getArtist` | Fetch one artist |
| `GET /catalog/albums/:id` | `CatalogApi.getAlbum` | Fetch one album |
| `GET /catalog/playlists/:id` | `CatalogApi.getPlaylist` | Fetch one playlist |
| `GET /catalog/trending` | `CatalogApi.getTrending` | Top songs by `play_count` |
| `GET /catalog/recommendations?basedOn=` | `CatalogApi.getRecommendations` | Song list from the taste-profile engine (same as `/discover/for-you`, without reasons); `basedOn` recommends songs like one track |
| `GET /atmosphere/song/:songId` | `AtmosphereApi.getAtmosphereForSong` | Cached or freshly OpenAI-generated AtmosphereProfile |
| `POST /atmosphere/mood` | `AtmosphereApi.getAtmosphereForMood` | Mood text -> OpenAI interpretation -> catalog match -> AtmosphereProfile |
| `GET /lyrics/:songId` | `LyricsApi.getLyrics` | Cached or freshly fetched (Genius) lyric lines |
| `GET /library/liked` | Library client | Fetch the signed-in user's liked songs |
| `GET /library/profile` | Settings/profile client | Fetch the signed-in user's display name and profile image |
| `DELETE /library/account` | Settings/profile client | Delete the user data, any artist content, and the Firebase account |
| `PUT /library/profile` | Settings/profile client | Partial update of `displayName`, `bio` and `showListening` |
| `POST /library/profile-image` | Settings/profile client | Upload or replace the user's profile image as multipart field `file` |
| `POST/DELETE /library/liked/:songId` | Library client | Like or unlike a song |
| `GET /library/history` | Library client | Fetch the signed-in user's listening history |
| `POST /library/history/:songId` | Library client | Record a played song |
| `GET /library/search-history` | Search client | Fetch the user's 20 most recent searches |
| `POST /library/search-history` | Search client | Save a query and optional selected result metadata |
| `DELETE /library/search-history?id=` | Search client | Delete one search by ID, or all searches when `id` is omitted |
| `GET/POST /library/playlists` | Library client | Owned and shared playlists (each with `role` and `version`), or create one |
| `GET /library/playlists/:playlistId` | Library client | Playlist plus `songs`, `owner`, `collaborators`, `role`, `version`; readable by owner, collaborators, or anyone if public |
| `POST /library/playlists/:playlistId/songs` | Library client | Add a song with `songId` or songs with `songIds` (owner or editor) |
| `DELETE /library/playlists/:playlistId` | Library client | Delete a playlist (owner only) |
| `GET/POST /library/worlds` | Library client | Fetch or save the user's music worlds |
| `PATCH /library/playlists/:id` | Playlist screen | Rename (owner/editor); `isPublic`, `description` (owner) |
| `DELETE /library/playlists/:id/songs/:songId` | Playlist screen | Remove a song (owner/editor) |
| `PUT /library/playlists/:id/order` | Playlist screen | New song order; songs others added or removed meanwhile are kept |
| `POST/DELETE /library/playlists/:id/invites` | Share panel | Create an invite link with `role` viewer/editor, or revoke all links (owner) |
| `GET /library/playlists/invites/:code` | Invite screen | Preview an invite |
| `POST /library/playlists/invites/:code/accept` | Invite screen | Join as a collaborator |
| `PATCH/DELETE /library/playlists/:id/collaborators/:userId` | Share panel | Change a role (owner), remove someone (owner), or leave (yourself) |
| `GET /discover/search?q=` | Search screen | Natural-language search: OpenAI turns the query into filters (cached in `nl_search_cache`), the catalogue is ranked against them; keyword fallback if OpenAI fails |
| `GET /discover/for-you` | Home | "Made for you": taste profile from likes, plays and follows; unheard songs, each with a reason |
| `GET /profiles/:userId` (or `me`) | Profiles | Public profile: bio, public playlists, top genres, recent listening (unless the user hid it) |
| `GET /catalog/artists/:id/stats` | Artist page | Followers, song count, likes across the artist's songs, total plays |
| `GET /invite/:code` (public) | Shared links | Small HTML page that opens `aura://invite/<code>` in the app |

`GET /atmosphere/song/:songId` now also returns a `sectionProfiles` timeline
(Intro/Verse/Chorus/…, each with its own colours, lighting, environment and
cat behaviour). The first play gets an estimate from lyrics timing; an AI
timeline is generated in the background and stored in `song_sections` for
later plays.

## Project II migrations

Run these once, in order, in the Supabase SQL editor (each is safe to re-run).
The Worker keeps working before they're applied, with the new features
reduced (e.g. no collaborators, estimated section timelines only).

| File | Adds |
|---|---|
| `migrations/001_discovery_features.sql` | `songs.mood_tags`, `activity_tags`, `features_source` (backfilled from existing atmosphere profiles) and the `nl_search_cache` table |
| `migrations/002_song_sections.sql` | `song_sections` table for AI section timelines |
| `migrations/003_playlist_collaboration.sql` | Playlist `version`/`updated_at`/`description`, `playlist_collaborators`, `playlist_invites` |
| `migrations/004_profiles.sql` | `user_profiles.bio`, `show_listening` |

## Tests

```
npm test
```

Runs the Vitest suites in `tests/`: the 30-query natural-language test set
(`tests/nl-search-queries.json`, proposal objective 2) against the keyword
fallback, search ranking, taste profile and recommendation reasons, section
timeline estimation and validation of AI output, playlist authorisation
(owner/editor/viewer/stranger) and concurrent-edit merging. To evaluate the
live OpenAI search, run the same 30 queries against `/discover/search` and
rate each result list.

## Known limitations (be aware before demoing)

### Search history behavior

Search history is unified per authenticated user, not split into separate song,
artist, album, and playlist histories. The Android app should save the query
once when the user submits it. If the user selects a result, it can also send
`resultType`, `resultId`, and `resultTitle`; these fields are optional. For
example:

```json
{
   "query": "Adele",
   "resultType": "artist",
   "resultId": "artist-123",
   "resultTitle": "Adele"
}
```

The search screen can show the returned rows as one recent-search list. A
search is not listening history: only `POST /library/history/:songId` records
a played song. Queue order, shuffle, and repeat should remain in Android's
player state; the backend supplies the catalog and listening-history data.

- **Lyrics timing is approximate** — Genius doesn't provide synced timestamps, so lines are evenly spaced across the song's duration. Good enough to demo the resonant-highlighting concept, not frame-accurate.
- **Genius lyrics fetching is lightweight scraping** of their public song page, since their API doesn't serve lyrics text directly (their terms don't allow it via the API). This is fine for a class prototype; a production app would need a licensed lyrics provider instead.
- **Recommendations need song features** — the taste-profile engine compares energy/valence and genres. Songs only get real energy/valence once an atmosphere profile has been generated for them (on first play), or from the backfill in `migrations/001_discovery_features.sql`; until then genre, artist and popularity carry the ranking.
- **Artist follows require migrations** — run `supabase_artist_follows_migration.sql` first, then `supabase_artist_song_relationship_migration.sql` in Supabase SQL Editor after the base schema. The second migration repairs orphaned song artists and adds the foreign key needed for nested recommendation queries.
- **Auth is now required on every `/catalog`, `/atmosphere`, `/lyrics` route** — every request needs a valid Firebase ID token. Playlist access is checked per request in `src/lib/playlistAccess.ts` (owner / editor / viewer, or public), and private playlists answer 404 to everyone else; see `tests/playlists.test.ts`.
