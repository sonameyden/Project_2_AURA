import type { AtmosphereProfile, Env, Song } from "../types";
import { sanitizeAtmosphereProfile } from "./atmosphere/profileSchema";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini"; // good cost/quality balance for structured JSON tasks like this

/**
 * Calls OpenAI's Chat Completions API with response_format=json_object so it
 * returns ONLY the JSON we ask for — no preamble to strip. Never called from
 * the Android app; only from inside this Worker (Section 9 of the project spec).
 */
async function callOpenAiJson(
  env: Env,
  systemPrompt: string,
  userPrompt: string,
  { temperature = 0.7, timeoutMs = 25_000 }: { temperature?: number; timeoutMs?: number } = {}
): Promise<any> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${errText}`);
  }

  const data = await res.json<any>();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return JSON.parse(content);
}

export interface MoodInterpretation {
  mode: "recommendations" | "direct_play";
  mood: string;
  targetValence: number;   // 0..1
  targetEnergy: number;    // 0..1
  suggestedGenres: string[];
  atmosphereHint: string;
  requestedSongTitle: string | null;
  requestedArtist: string | null;
  reply: string;
}

/**
 * Step 1 of the mood flow (Section 9): free-text mood -> structured targets
 * used to query the real song catalog. OpenAI does NOT pick a literal song
 * here — it has no knowledge of your catalog, only Supabase does.
 */
export async function interpretMood(env: Env, moodText: string): Promise<MoodInterpretation> {
  const systemPrompt = `You are the mood-interpretation engine for a music app called AURA.
Given free-text describing how a user feels, output ONLY a JSON object with this exact shape:
{
  "mode": "recommendations" when the user is mainly describing feelings and wants suggestions, or "direct_play" when they ask to hear/listen to something or name a song,
  "mood": string (short label, e.g. "lonely" or "hopeful-nostalgic"),
  "targetValence": number between 0 and 1 (0 = very negative, 1 = very positive),
  "targetEnergy": number between 0 and 1 (0 = very calm/slow, 1 = very energetic/fast),
  "suggestedGenres": array of 2-4 genre strings that would fit this mood,
  "atmosphereHint": string, a short phrase describing the visual atmosphere that would fit (e.g. "melancholic-comforting"),
  "requestedSongTitle": string or null, only when the user names a specific song,
  "requestedArtist": string or null, only when the user names a specific artist,
  "reply": string, a short warm response to the user's message
}
Rules: use direct_play for requests such as "play something calm", "I want to listen to music", or "play Starboy by The Weeknd". Use recommendations when the user says how they feel, such as "I feel sad". Do not invent a requested song title or artist. Do not include any text outside the JSON object.`;

  return callOpenAiJson(env, systemPrompt, moodText) as Promise<MoodInterpretation>;
}

/**
 * Step 2 of the mood flow / the main atmosphere generation call (Section 9):
 * combines the song's own genre/lyrics with (optionally) the user's mood text
 * to produce the full AtmosphereProfile every visual layer in the app reads from.
 *
 * `userMoodText` is null when this is called from the plain /atmosphere/song/{id}
 * route (no mood context, e.g. user just tapped a song directly) — per Section 6
 * of the original concept, song emotion and user emotion are considered
 * separately and don't have to match.
 */
export async function generateAtmosphereProfile(
  env: Env,
  song: Song,
  lyricsText: string | null,
  userMoodText: string | null
): Promise<AtmosphereProfile> {
  const systemPrompt = `You are the Atmosphere Engine for a music app called AURA. Your job is to
interpret a song (and optionally the listener's stated mood) into a structured
"AtmosphereProfile" JSON object that drives the app's visuals — a Rive-animated
background environment, a cat companion's behavior, a music-reactive kaleidoscope,
particles, and lyric highlighting.

Output ONLY a JSON object with EXACTLY this shape and these exact enum values
(case-sensitive, no other values are valid):

{
  "songId": string (echo back the id given to you),
  "emotion": string (short free-text label, e.g. "melancholic-comforting"),
  "energy": number 0-1,
  "valence": number 0-1,
  "environment": one of ["Heaven","Nature","Ocean","Dream","Romantic","Melancholic","Hopeful","Energetic"],
  "primaryColorHex": string, a hex color fitting the environment/mood,
  "secondaryColorHexes": array of 1-3 hex color strings,
  "lightingStyle": one of ["Soft","Bright","Dramatic","Fading"],
  "particleStyle": one of ["Dust","Rain","Bubbles","Petals","Stars","Sparks","None"],
  "kaleidoscopeStyle": one of ["SoftOrganic","FluidSymmetry","WaveLike","SharpGeometric","DarkReflective","Floral"],
  "catBehavior": one of ["Idle","Sleeping","Walking","Stretching","Playing","Running","Watching"],
  "transitionStyle": one of ["Gentle","Progressive","Sharp"],
  "resonantLyricLineIds": array containing zero or one string only (empty array if no lyrics were provided or no user mood context was given; when both are present, choose only the single lyric line that most genuinely resonates with the user's feeling),
  "sectionProfiles": [] (leave as an empty array — not used in this version)
}

Do not include any text outside the JSON object.`;

  const userPromptParts = [
    `Song: "${song.title}" by ${song.artistName}`,
    song.genre ? `Genre: ${song.genre}` : null,
    lyricsText ? `Lyrics:\n${lyricsText}` : "No lyrics available for this song.",
    userMoodText ? `The listener described their current feeling as: "${userMoodText}"` : "No user mood context was provided — base the profile purely on the song itself.",
  ].filter(Boolean).join("\n\n");

  const result = await callOpenAiJson(env, systemPrompt, userPromptParts);
  // Schema-check every field (enums, colours, ranges); the song id is enforced.
  // Sections come from the separate timeline step, so start empty here.
  return { ...sanitizeAtmosphereProfile(result, song.id), sectionProfiles: [] };
}

/**
 * Natural-language search (Project II): turns "calm songs for studying at
 * night" into structured filters. The model never names catalogue songs; the
 * Worker matches these filters against Supabase. The caller validates the
 * output with `validateInterpretation` and falls back to keywords on failure.
 */
export async function interpretSearchQuery(env: Env, query: string): Promise<unknown> {
  const systemPrompt = `You turn a music search query into JSON filters for the AURA music app.
Output ONLY a JSON object with exactly these keys:
{
  "isDescriptive": boolean — false if the query is just a song title or artist name (e.g. "starboy", "taylor swift"), true if it describes a mood, activity, genre or feeling,
  "moods": array of 0-4 short lowercase mood words (e.g. "calm", "sad", "happy", "energetic", "romantic", "dreamy", "nostalgic", "intense", "hopeful"),
  "genres": array of 0-4 lowercase genre names (e.g. "indie", "lofi", "pop", "rock", "hip hop", "jazz", "classical", "electronic", "r&b", "acoustic"),
  "activities": array of 0-3 from ["study","sleep","workout","party","driving","morning","relax","focus","walking","cooking"],
  "targetEnergy": number 0-1 or null (0 = very calm/slow, 1 = very intense/fast); null if the query implies nothing,
  "targetValence": number 0-1 or null (0 = very sad/dark, 1 = very happy/bright); null if the query implies nothing,
  "artistHints": array of artist names explicitly mentioned (e.g. "songs like Coldplay" -> ["coldplay"]), else [],
  "titleHints": array of song titles explicitly mentioned, else [],
  "summary": a short phrase describing what the user wants, max 10 words (e.g. "Calm, low-energy songs for studying at night")
}
Never invent artists or titles that are not in the query. No text outside the JSON.`;

  return callOpenAiJson(env, systemPrompt, query, { temperature: 0.2, timeoutMs: 8_000 });
}

/**
 * Section timeline (Project II): splits a song into Intro/Verse/Chorus/... with
 * a palette, lighting, environment and cat behaviour per section, so Now
 * Playing can change through the song. Timed lyrics give the model real
 * boundaries; the caller validates the result with `validateTimeline`.
 */
export async function generateSectionTimeline(
  env: Env,
  song: Song,
  profile: AtmosphereProfile,
  lyrics: { text: string; startTimeMs: number }[]
): Promise<unknown> {
  const systemPrompt = `You design the visual timeline for one song in the AURA music app.
Return ONLY a JSON object: { "sections": [ ... ] } with 4-10 sections in time order. Each section:
{
  "section": one of ["Intro","Verse","PreChorus","Chorus","Bridge","FinalChorus","Outro"],
  "startTimeMs": integer, where this section starts (first section starts at 0),
  "intensityMultiplier": number 0.4-1.5 (quiet intro ~0.6, chorus ~1.15, final chorus ~1.3, outro ~0.55),
  "environment": one of ["Heaven","Nature","Ocean","Dream","Romantic","Melancholic","Hopeful","Energetic"] — usually the song's base environment; change it only when the mood clearly shifts (e.g. a hopeful bridge),
  "primaryColorHex": "#RRGGBB",
  "secondaryColorHexes": 1-3 "#RRGGBB" colours,
  "lightingStyle": one of ["Soft","Bright","Dramatic","Fading"],
  "catBehavior": one of ["Idle","Sleeping","Walking","Stretching","Playing","Running","Watching","Dancing"] — Dancing for high-energy choruses, Running for fast driving parts, Watching for calm or lyrical moments, Sleeping only for very quiet parts
}
Keep colours related to the base palette so changes feel like one world evolving. Use the timed lyrics to place boundaries: repeated lines usually mark the chorus. No text outside the JSON.`;

  const timedLyrics = lyrics
    .slice(0, 120)
    .map((line) => {
      const seconds = Math.floor(line.startTimeMs / 1000);
      return `[${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}] ${line.text}`;
    })
    .join("\n");

  const userPrompt = [
    `Song: "${song.title}" by ${song.artistName}${song.genre ? ` (${song.genre})` : ""}`,
    `Duration: ${Math.round(song.durationMs / 1000)} seconds (${song.durationMs} ms)`,
    `Base atmosphere: emotion ${profile.emotion}, energy ${profile.energy}, valence ${profile.valence}, environment ${profile.environment}, primary ${profile.primaryColorHex}, secondary ${profile.secondaryColorHexes.join(", ")}, lighting ${profile.lightingStyle}, cat ${profile.catBehavior}`,
    timedLyrics ? `Timed lyrics:\n${timedLyrics}` : "No lyrics are available; estimate a typical structure from the duration and genre.",
  ].join("\n\n");

  return callOpenAiJson(env, systemPrompt, userPrompt, { temperature: 0.5, timeoutMs: 20_000 });
}
