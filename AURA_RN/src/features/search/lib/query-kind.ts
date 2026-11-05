const DESCRIPTIVE_WORDS =
  /\b(songs?|music|tracks?|something|vibes?|for|like|when|while|feel|feeling|mood|calm|chill|sad|happy|upbeat|study|studying|sleep|workout|run|running|party|night|morning|rain|slow|fast|relax|focus|romantic|dreamy|energetic)\b/i;

/**
 * Whether a query reads like a description ("calm songs for studying") rather
 * than a title. Short title lookups skip the AI search to save time and cost.
 */
export function looksDescriptive(term: string) {
  const words = term.trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 || (words.length >= 1 && DESCRIPTIVE_WORDS.test(term));
}
