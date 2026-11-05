import type { SupabaseClient } from "@supabase/supabase-js";
import type { Song } from "../../types";
import { rowToSong } from "../mappers";

/** A catalog song plus the audio/mood features the discovery engine scores on. */
export interface SongFeatures {
  song: Song;
  /** 0..1, null when the catalog still holds the 0.5 placeholder default. */
  valence: number | null;
  energy: number | null;
  playCount: number;
  moodTags: string[];
  activityTags: string[];
}

const CATALOG_LIMIT = 1000;

function toUnit(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}

function toTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.toLowerCase())
    : [];
}

export function rowToFeatures(row: any): SongFeatures {
  // `features_source` is added by the Phase 2 migration. Before it runs (or for
  // songs never analysed) 0.5/0.5 is a placeholder, not a measurement.
  const measured = row.features_source && row.features_source !== "default";
  const valence = toUnit(row.valence);
  const energy = toUnit(row.energy);
  const looksDefault = valence === 0.5 && energy === 0.5;
  return {
    song: rowToSong(row),
    valence: measured || !looksDefault ? valence : null,
    energy: measured || !looksDefault ? energy : null,
    playCount: typeof row.play_count === "number" ? row.play_count : 0,
    moodTags: toTags(row.mood_tags),
    activityTags: toTags(row.activity_tags),
  };
}

/** The whole (small) catalog; scoring happens in the Worker. */
export async function fetchCatalog(supabase: SupabaseClient): Promise<SongFeatures[]> {
  const { data, error } = await supabase.from("songs").select("*").limit(CATALOG_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToFeatures);
}
