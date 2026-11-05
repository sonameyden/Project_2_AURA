/**
 * Structured meaning of a descriptive search such as "calm songs for studying
 * at night". Produced by OpenAI, validated here, with a keyword fallback so
 * search still works (less cleverly) when OpenAI is slow or unavailable.
 */
export interface QueryInterpretation {
  /** False for plain title/artist lookups like "starboy". */
  isDescriptive: boolean;
  moods: string[];
  genres: string[];
  activities: string[];
  /** 0..1 or null when the query says nothing about it. */
  targetEnergy: number | null;
  targetValence: number | null;
  artistHints: string[];
  titleHints: string[];
  /** Short human summary, e.g. "Calm, low-energy songs for studying". */
  summary: string;
  source: "openai" | "keywords";
}

const MAX_LIST = 6;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = item.trim().toLowerCase().slice(0, 40);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_LIST) break;
  }
  return [...seen];
}

function cleanUnit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

/** Schema check for the model's JSON: drops anything malformed instead of trusting it. */
export function validateInterpretation(raw: unknown, query: string): QueryInterpretation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const interpretation: QueryInterpretation = {
    isDescriptive: value.isDescriptive !== false,
    moods: cleanList(value.moods),
    genres: cleanList(value.genres),
    activities: cleanList(value.activities),
    targetEnergy: cleanUnit(value.targetEnergy),
    targetValence: cleanUnit(value.targetValence),
    artistHints: cleanList(value.artistHints),
    titleHints: cleanList(value.titleHints),
    summary: typeof value.summary === "string" && value.summary.trim() ? value.summary.trim().slice(0, 140) : query,
    source: "openai",
  };
  const hasSignal =
    interpretation.moods.length +
      interpretation.genres.length +
      interpretation.activities.length +
      interpretation.artistHints.length +
      interpretation.titleHints.length >
      0 ||
    interpretation.targetEnergy !== null ||
    interpretation.targetValence !== null;
  return hasSignal ? interpretation : null;
}

type Lexeme = {
  words: string[];
  mood?: string;
  activity?: string;
  energy?: number;
  valence?: number;
};

// Small keyword lexicon for the offline fallback. Energy/valence targets are
// deliberately coarse; OpenAI does the nuanced version.
const LEXICON: Lexeme[] = [
  { words: ["calm", "chill", "relax", "relaxing", "peaceful", "soft", "gentle", "mellow", "unwind", "quiet"], mood: "calm", energy: 0.25 },
  { words: ["sleep", "asleep", "sleepy", "bedtime", "lullaby"], mood: "calm", activity: "sleep", energy: 0.12 },
  { words: ["hopeful", "hope", "uplifting", "fresh", "inspiring"], mood: "hopeful", valence: 0.75 },
  { words: ["study", "studying", "focus", "focused", "work", "working", "reading"], activity: "study", energy: 0.3 },
  { words: ["night", "late", "midnight"], mood: "nocturnal", energy: 0.35 },
  { words: ["sad", "heartbreak", "heartbroken", "cry", "crying", "lonely", "melancholy", "melancholic", "rain", "rainy"], mood: "sad", valence: 0.2, energy: 0.3 },
  { words: ["happy", "joy", "joyful", "sunny", "cheerful", "cheer", "bright", "good"], mood: "happy", valence: 0.82 },
  { words: ["upbeat", "energetic", "hype", "pump", "pumped", "power"], mood: "energetic", energy: 0.85, valence: 0.7 },
  { words: ["run", "running", "workout", "gym", "training", "exercise"], activity: "workout", energy: 0.88 },
  { words: ["party", "dance", "dancing", "club"], activity: "party", mood: "energetic", energy: 0.85, valence: 0.78 },
  { words: ["drive", "driving", "road", "roadtrip"], activity: "driving", energy: 0.65 },
  { words: ["morning", "sunrise", "wake"], mood: "hopeful", activity: "morning", valence: 0.72, energy: 0.55 },
  { words: ["romantic", "love", "date", "crush"], mood: "romantic", valence: 0.7, energy: 0.4 },
  { words: ["angry", "rage", "intense", "aggressive"], mood: "intense", energy: 0.9, valence: 0.25 },
  { words: ["dreamy", "ethereal", "ambient", "space", "floaty"], mood: "dreamy", energy: 0.3 },
  { words: ["nostalgic", "memories", "throwback"], mood: "nostalgic", valence: 0.45 },
  { words: ["slow"], energy: 0.2 },
  { words: ["fast"], energy: 0.85 },
];

const GENRES = [
  "pop", "rock", "indie", "jazz", "hip hop", "hip-hop", "rap", "r&b", "rnb", "soul", "classical", "electronic",
  "edm", "house", "techno", "lofi", "lo-fi", "acoustic", "folk", "country", "metal", "punk", "ambient", "k-pop",
  "kpop", "blues", "reggae", "latin", "funk", "soundtrack", "piano",
];

const DESCRIPTIVE_HINTS = /\b(songs?|music|tracks?|something|vibes?|for|like|when|while|feel|feeling|mood)\b/i;

/** Keyword-only interpretation used when OpenAI fails or is skipped. */
export function heuristicInterpretation(query: string): QueryInterpretation {
  const text = query.toLowerCase();
  const words = text.split(/[^a-z0-9&'-]+/).filter(Boolean);
  const moods = new Set<string>();
  const activities = new Set<string>();
  const energies: number[] = [];
  const valences: number[] = [];

  for (const lexeme of LEXICON) {
    if (!lexeme.words.some((word) => words.includes(word))) continue;
    if (lexeme.mood) moods.add(lexeme.mood);
    if (lexeme.activity) activities.add(lexeme.activity);
    if (lexeme.energy !== undefined) energies.push(lexeme.energy);
    if (lexeme.valence !== undefined) valences.push(lexeme.valence);
  }
  const genres = GENRES.filter((genre) => new RegExp(`\\b${genre.replace(/[-&]/g, "\\$&")}\\b`).test(text));
  const average = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
  const isDescriptive = moods.size + activities.size + genres.length > 0 || DESCRIPTIVE_HINTS.test(text);

  return {
    isDescriptive,
    moods: [...moods],
    genres,
    activities: [...activities],
    targetEnergy: average(energies),
    targetValence: average(valences),
    artistHints: [],
    titleHints: isDescriptive ? [] : [query.trim().toLowerCase()],
    summary: query.trim(),
    source: "keywords",
  };
}
