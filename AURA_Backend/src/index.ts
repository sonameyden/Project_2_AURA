import { Hono } from "hono";
import type { Env } from "./types";
import { corsMiddleware } from "./lib/cors";
import { requireAuth } from "./lib/firebaseAuth";
import { rateLimit } from "./lib/rateLimit";
import { catalogRoutes } from "./routes/catalog";
import { atmosphereRoutes } from "./routes/atmosphere";
import { lyricsRoutes } from "./routes/lyrics";
import { libraryRoutes } from "./routes/library";
import { discoverRoutes } from "./routes/discover";
import { invitePageRoutes } from "./routes/invitePage";
import { profileRoutes } from "./routes/profiles";

/**
 * Entry point. Route prefixes match exactly what the Android app's Retrofit
 * interfaces call — see core/data/remote/*.kt in the Android project.
 *   CatalogApi     -> /catalog/*
 *   AtmosphereApi  -> /atmosphere/*
 *   LyricsApi      -> /lyrics/*
 *
 * Every route below requireAuth needs a valid Firebase ID token (attached
 * automatically by the Android app's NetworkModule interceptor once the
 * user is logged in — see core/data/di/NetworkModule.kt). "/" is
 * intentionally public, useful as an uptime check.
 */
const app = new Hono<{ Bindings: Env }>();

app.use("*", corsMiddleware);

app.get("/", (c) => c.json({ service: "aura-backend", status: "ok" }));
// Public: hands playlist invite links off to the app (no data exposed).
app.route("/invite", invitePageRoutes);

app.use("/catalog/*", requireAuth);
app.use("/atmosphere/*", requireAuth);
app.use("/lyrics/*", requireAuth);
app.use("/library/*", requireAuth);
app.use("/discover/*", requireAuth);
app.use("/profiles/*", requireAuth);

// Per-user rate limits (after auth, so each user has their own budget). OpenAI-backed
// endpoints get a tighter limit because every call costs money.
for (const prefix of ["/catalog/*", "/atmosphere/*", "/lyrics/*", "/library/*", "/discover/*", "/profiles/*"]) {
  app.use(prefix, rateLimit("API_RATE_LIMITER"));
}
app.use("/discover/search", rateLimit("AI_RATE_LIMITER"));
app.use("/atmosphere/mood", rateLimit("AI_RATE_LIMITER"));

app.route("/catalog", catalogRoutes);
app.route("/atmosphere", atmosphereRoutes);
app.route("/lyrics", lyricsRoutes);
app.route("/library", libraryRoutes);
app.route("/discover", discoverRoutes);
app.route("/profiles", profileRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
