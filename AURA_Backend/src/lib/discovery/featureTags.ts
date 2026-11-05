import type { AtmosphereProfile } from "../../types";

const ENVIRONMENT_MOODS: Record<AtmosphereProfile["environment"], string[]> = {
  Heaven: ["peaceful", "uplifting"],
  Nature: ["calm", "organic"],
  Ocean: ["calm", "flowing"],
  Dream: ["dreamy", "ethereal"],
  Romantic: ["romantic", "warm"],
  Melancholic: ["sad", "melancholic"],
  Hopeful: ["hopeful", "uplifting"],
  Energetic: ["energetic", "intense"],
};

/**
 * Derives searchable mood and activity tags from a generated atmosphere
 * profile, so natural-language search can match songs once they have been
 * analysed. Activities are a coarse guess from energy and valence.
 */
export function tagsFromAtmosphere(profile: AtmosphereProfile): { moodTags: string[]; activityTags: string[] } {
  const emotionWords = profile.emotion
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 2);
  const moodTags = [...new Set([...emotionWords, ...(ENVIRONMENT_MOODS[profile.environment] ?? [])])].slice(0, 8);

  const activityTags: string[] = [];
  if (profile.energy < 0.3) activityTags.push("sleep", "relax", "study");
  else if (profile.energy < 0.55) activityTags.push("study", "focus", "relax");
  else if (profile.energy < 0.75) activityTags.push("driving", "walking", "cooking");
  else activityTags.push("workout", "party");
  if (profile.valence > 0.6 && profile.energy > 0.4) activityTags.push("morning");

  return { moodTags, activityTags: [...new Set(activityTags)] };
}
