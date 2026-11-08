export type Song = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  durationMs: number;
  streamUrl: string;
  artworkUrl: string | null;
  genre: string | null;
  releaseDate: string | null;
  energy?: number;
  valence?: number;
};

export type Artist = {
  id: string;
  name: string;
  bio: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  followerCount: number;
  monthlyListeners: number;
};

export type Album = {
  id: string;
  title: string;
  artistId: string;
  artworkUrl: string | null;
  songIds: string[];
  releaseDate: string | null;
};

export type Playlist = {
  id: string;
  title: string;
  ownerId: string;
  songIds: string[];
  isPublic: boolean;
  coverColorHex: string | null;
};

export type AtmosphereProfile = {
  songId: string;
  emotion: string;
  energy: number;
  valence: number;
  environment: 'Heaven' | 'Nature' | 'Ocean' | 'Dream' | 'Romantic' | 'Melancholic' | 'Hopeful' | 'Energetic';
  primaryColorHex: string;
  secondaryColorHexes: string[];
  lightingStyle: 'Soft' | 'Bright' | 'Dramatic' | 'Fading';
  particleStyle: 'Dust' | 'Rain' | 'Bubbles' | 'Petals' | 'Stars' | 'Sparks' | 'None';
  kaleidoscopeStyle: 'SoftOrganic' | 'FluidSymmetry' | 'WaveLike' | 'SharpGeometric' | 'DarkReflective' | 'Floral';
  catBehavior: 'Idle' | 'Sleeping' | 'Walking' | 'Stretching' | 'Playing' | 'Running' | 'Watching';
  transitionStyle: 'Gentle' | 'Progressive' | 'Sharp';
  resonantLyricLineIds: string[];
  sectionProfiles: SongSectionProfile[];
};

export type LyricLine = {
  id: string;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
};

export type SearchResults = {
  songs: Song[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
};

export type MoodResponse = {
  mode: 'recommendations' | 'direct_play';
  reply: string;
  songs: Song[];
  song: Song | null;
  atmosphereProfile: AtmosphereProfile | null;
};

export type UserProfile = {
  userId: string;
  displayName: string | null;
  imageUrl: string | null;
  bio?: string | null;
  /** Whether other people can see recent listening and top genres. */
  showListening?: boolean;
};

export type SearchHistoryEntry = {
  id: number;
  query: string;
  result_type: 'song' | 'artist' | 'album' | 'playlist' | null;
  result_id: string | null;
  result_title: string | null;
  searched_at: string;
};

/** GET /discover/search — natural-language search. */
export type NaturalSearchResponse = {
  query: string;
  isDescriptive: boolean;
  summary: string;
  filters: {
    moods: string[];
    genres: string[];
    activities: string[];
    targetEnergy: number | null;
    targetValence: number | null;
  };
  /** 'keywords' means OpenAI was unavailable and a simpler matcher was used. */
  source: 'openai' | 'keywords';
  results: { song: Song; score: number; reason: string }[];
};

/** GET /discover/for-you — "Made for you" recommendations. */
export type ForYouResponse = {
  profile: {
    label: string | null;
    topGenres: string[];
    averageEnergy: number | null;
    averageValence: number | null;
    basedOn: { likes: number; plays: number; follows: number };
  };
  items: { song: Song; reason: string }[];
};

/** Cat behaviours; `Dancing` only appears inside section timelines. */
export type CatBehavior = AtmosphereProfile['catBehavior'] | 'Dancing';

/**
 * One part of a song's visual timeline (Project II). Older backends only send
 * the first three fields, so the look fields are optional.
 */
export type SongSectionProfile = {
  section: 'Intro' | 'Verse' | 'PreChorus' | 'Chorus' | 'Bridge' | 'FinalChorus' | 'Outro';
  startTimeMs: number;
  intensityMultiplier: number;
  endTimeMs?: number;
  environment?: AtmosphereProfile['environment'];
  primaryColorHex?: string;
  secondaryColorHexes?: string[];
  lightingStyle?: AtmosphereProfile['lightingStyle'];
  catBehavior?: CatBehavior;
  source?: 'ai' | 'estimated';
};

export type PlaylistRole = 'owner' | 'editor' | 'viewer';

/** A playlist as listed for the signed-in user, with their role in it. */
export type PlaylistSummary = Playlist & {
  role: PlaylistRole;
  /** Increments on every change; used to spot collaborators' edits. */
  version: number;
  description: string | null;
  updatedAt: string | null;
};

export type PlaylistPerson = { userId: string; displayName: string | null; imageUrl: string | null };

export type PlaylistDetail = PlaylistSummary & {
  songs: Song[];
  owner: PlaylistPerson;
  /** False for people who can only see it because it's public. */
  isMember?: boolean;
  /** Empty for viewers. */
  collaborators: (PlaylistPerson & { role: 'viewer' | 'editor' })[];
};

export type PlaylistInvite = {
  code: string;
  role: 'viewer' | 'editor';
  expiresAt: string;
  /** https link that opens the app; safe to paste anywhere. */
  url: string;
  appUrl: string;
};

export type InvitePreview = {
  code: string;
  role: 'viewer' | 'editor';
  playlist: { id: string; title: string; songCount: number };
  owner: PlaylistPerson;
  alreadyMember: boolean;
};

/** GET /profiles/:userId — what others see on a listener's profile. */
export type PublicProfile = {
  userId: string;
  isSelf: boolean;
  displayName: string | null;
  imageUrl: string | null;
  bio: string | null;
  showListening: boolean;
  /** True when the user hid their listening from others. */
  listeningHidden: boolean;
  stats: { publicPlaylists: number; following: number; likedSongs: number };
  topGenres: string[];
  recentListening: Song[];
  publicPlaylists: Playlist[];
  /** Set when this listener also has an artist page. */
  artist: Artist | null;
};

export type ArtistStats = { artistId: string; followers: number; songs: number; likes: number; plays: number };
