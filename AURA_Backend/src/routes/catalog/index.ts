import { Hono } from "hono";
import type { AppEnv } from "../../lib/context";
import { albumRoutes } from "./albums";
import { artistRoutes } from "./artists";
import { discoveryRoutes } from "./discovery";
import { songRoutes } from "./songs";

/**
 * `/catalog/*` — songs, artists, albums and discovery. Reads only from
 * Supabase; never calls OpenAI. Row shapes are documented in lib/supabase.ts.
 *
 * Mount order matters: Hono tries handlers in registration order, and
 * discovery owns static paths such as `/songs/search` and `/albums/search`
 * that must win over `/songs/:id` and `/albums/:id`.
 */
export const catalogRoutes = new Hono<AppEnv>();

catalogRoutes.route("/", discoveryRoutes);
catalogRoutes.route("/", songRoutes);
catalogRoutes.route("/", artistRoutes);
catalogRoutes.route("/", albumRoutes);
