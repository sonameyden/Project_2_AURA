import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "../lib/context";
import type { Env } from "../types";
import { fetchCatalog } from "../lib/discovery/catalog";
import { rankCatalog } from "../lib/discovery/naturalSearch";
import {
  heuristicInterpretation,
  validateInterpretation,
  type QueryInterpretation,
} from "../lib/discovery/queryInterpretation";
import { loadTasteSignals } from "../lib/discovery/signals";
import { buildTasteProfile, recommend } from "../lib/discovery/tasteProfile";
import { interpretSearchQuery } from "../lib/openai";
import { getSupabase } from "../lib/supabase";

/**
 * Project II discovery features:
 *   GET /discover/search?q=   natural-language search ("calm songs for studying")
 *   GET /discover/for-you     "Made for you" recommendations with reasons
 * OpenAI only interprets the query; songs always come from the catalogue.
 */
export const discoverRoutes = new Hono<AppEnv>();

const MAX_QUERY_LENGTH = 200;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Interprets a query, using the `nl_search_cache` table so repeated queries
 * never re-call OpenAI. Any OpenAI or validation failure falls back to the
 * keyword interpreter instead of failing the search.
 */
async function interpret(env: Env, supabase: SupabaseClient, query: string): Promise<QueryInterpretation> {
  const normalised = query.trim().toLowerCase().replace(/\s+/g, " ");
  const key = await sha256(normalised);

  const cached = await supabase.from("nl_search_cache").select("interpretation").eq("query_hash", key).maybeSingle();
  if (!cached.error && cached.data?.interpretation) {
    const valid = validateInterpretation(cached.data.interpretation, query);
    if (valid) return valid;
  }

  try {
    const raw = await interpretSearchQuery(env, query);
    const valid = validateInterpretation(raw, query);
    if (!valid) return heuristicInterpretation(query);
    // A failed cache write (e.g. migration not applied yet) must not fail the search.
    await supabase
      .from("nl_search_cache")
      .upsert({ query_hash: key, query: normalised, interpretation: valid })
      .then(({ error }) => error && console.warn("nl_search_cache write skipped:", error.message));
    return valid;
  } catch (error) {
    console.warn("OpenAI query interpretation failed; using keywords.", (error as Error).message);
    return heuristicInterpretation(query);
  }
}

discoverRoutes.get("/search", async (c) => {
  const query = (c.req.query("q") ?? "").trim();
  if (!query) return c.json({ error: "q is required" }, 400);
  if (query.length > MAX_QUERY_LENGTH) {
    return c.json({ error: `q must be ${MAX_QUERY_LENGTH} characters or fewer` }, 400);
  }

  const supabase = getSupabase(c.env);
  try {
    const [interpretation, catalog] = await Promise.all([interpret(c.env, supabase, query), fetchCatalog(supabase)]);
    const results = interpretation.isDescriptive ? rankCatalog(catalog, interpretation) : [];
    return c.json({
      query,
      isDescriptive: interpretation.isDescriptive,
      summary: interpretation.summary,
      filters: {
        moods: interpretation.moods,
        genres: interpretation.genres,
        activities: interpretation.activities,
        targetEnergy: interpretation.targetEnergy,
        targetValence: interpretation.targetValence,
      },
      source: interpretation.source,
      results: results.map(({ song, score, reason }) => ({ song, score: Math.round(score * 100) / 100, reason })),
    });
  } catch (error) {
    return c.json({ error: `Search failed: ${(error as Error).message}` }, 500);
  }
});

discoverRoutes.get("/for-you", async (c) => {
  const supabase = getSupabase(c.env);
  try {
    const [signals, catalog] = await Promise.all([loadTasteSignals(supabase, c.get("auth").uid), fetchCatalog(supabase)]);
    const profile = buildTasteProfile(signals, catalog);
    const items = recommend(profile, catalog, signals);
    return c.json({
      profile: {
        label: profile.label,
        topGenres: profile.topGenres,
        averageEnergy: profile.averageEnergy,
        averageValence: profile.averageValence,
        basedOn: {
          likes: signals.likedSongIds.length,
          plays: signals.historySongIds.length,
          follows: signals.followedArtistIds.length,
        },
      },
      items: items.map(({ song, reason }) => ({ song, reason })),
    });
  } catch (error) {
    return c.json({ error: `Recommendations failed: ${(error as Error).message}` }, 500);
  }
});
