import type { LyricLine } from "../types";

const LRCLIB_USER_AGENT = "AURA Music App/1.0 (sonameyden2005@gmail.com)";

interface LrcLibTrack {
  trackName?: string;
  artistName?: string;
  duration?: number;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/** Fetches synchronized lyrics from LRCLIB, with search and plain-text fallbacks. */
export async function fetchLyrics(title: string, artist: string, durationMs: number): Promise<LyricLine[] | null> {
  const durationSeconds = Math.max(1, Math.round(durationMs / 1000));
  const headers = { "User-Agent": LRCLIB_USER_AGENT };
  const exactParams = new URLSearchParams({
    track_name: title,
    artist_name: artist,
    duration: `${durationSeconds}`,
  });

  const exactResponse = await fetch(`https://lrclib.net/api/get?${exactParams}`, { headers });
  let track: LrcLibTrack | null = exactResponse.ok ? await exactResponse.json<LrcLibTrack>() : null;

  if (!track) {
    const searchParams = new URLSearchParams({ track_name: title, artist_name: artist });
    const searchResponse = await fetch(`https://lrclib.net/api/search?${searchParams}`, { headers });
    if (searchResponse.ok) {
      const results = await searchResponse.json<LrcLibTrack[]>();
      track = results.find((candidate) => candidate.syncedLyrics || candidate.plainLyrics) ?? results[0] ?? null;
    }
  }

  if (!track) return null;
  if (track.syncedLyrics) return parseSyncedLyrics(track.syncedLyrics, durationMs);
  if (track.plainLyrics) return evenlySpaceLyrics(track.plainLyrics, durationMs);
  return null;
}

function parseSyncedLyrics(value: string, durationMs: number): LyricLine[] {
  const entries: Array<{ startTimeMs: number; text: string }> = [];
  const timestampPattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)/;

  for (const rawLine of value.split(/\r?\n/)) {
    const match = rawLine.match(timestampPattern);
    if (!match) continue;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fraction = match[3] ?? "0";
    const fractionMs =
      fraction.length === 1
        ? Number(fraction) * 100
        : fraction.length === 2
          ? Number(fraction) * 10
          : Number(fraction.slice(0, 3));
    const text = match[4].trim();
    if (text) entries.push({ startTimeMs: minutes * 60_000 + seconds * 1_000 + fractionMs, text });
  }

  return entries.map((entry, index) => ({
    id: `${index}`,
    text: entry.text,
    startTimeMs: entry.startTimeMs,
    endTimeMs: entries[index + 1]?.startTimeMs ?? durationMs,
  }));
}

function evenlySpaceLyrics(value: string, durationMs: number): LyricLine[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const msPerLine = lines.length > 0 ? durationMs / lines.length : 0;
  return lines.map((text, index) => ({
    id: `${index}`,
    text,
    startTimeMs: Math.round(index * msPerLine),
    endTimeMs: Math.round((index + 1) * msPerLine),
  }));
}
