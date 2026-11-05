import { Context, Next } from "hono";

/**
 * Basic CORS handling — mostly relevant if you ever hit this API from a web
 * client (e.g. an admin dashboard) in addition to the Android app, which
 * doesn't need CORS at all. Kept permissive for development; tighten
 * `Access-Control-Allow-Origin` to a real origin list before production.
 */
export async function corsMiddleware(c: Context, next: Next) {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
}
