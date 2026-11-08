import { Context, Next } from "hono";
import type { Env } from "../types";

/** Browser origins allowed in development when ALLOWED_ORIGINS isn't set (Expo's web dev servers). */
const DEV_ORIGINS = ["http://localhost:8081", "http://localhost:19006"];

/**
 * Origins allowed to call the API from a browser: the comma-separated
 * ALLOWED_ORIGINS variable, or the local Expo web dev servers outside production.
 */
export function allowedOrigins(env: Pick<Env, "ALLOWED_ORIGINS" | "ENVIRONMENT">): string[] {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return env.ENVIRONMENT === "production" ? [] : DEV_ORIGINS;
}

/**
 * CORS for the web build. Native apps send no Origin header and don't need
 * CORS; browsers only get access from an allowed origin (never "*").
 */
export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const origin = c.req.header("Origin");
  if (origin && allowedOrigins(c.env ?? ({} as Env)).includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
    c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", "600");
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
}
