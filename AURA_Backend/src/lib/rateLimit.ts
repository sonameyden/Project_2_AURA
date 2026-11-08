import type { Context, Next } from "hono";
import type { AppEnv } from "./context";

type LimiterBinding = "API_RATE_LIMITER" | "AI_RATE_LIMITER";

/**
 * Per-user rate limiting with Cloudflare's Rate Limiting binding (configured
 * in wrangler.toml). Runs after requireAuth, so each signed-in user has their
 * own budget. If the binding isn't configured (tests, older deployments),
 * requests pass through.
 */
export function rateLimit(binding: LimiterBinding) {
  return async (c: Context<AppEnv>, next: Next) => {
    const limiter = c.env?.[binding];
    if (limiter) {
      const key = c.get("auth")?.uid ?? c.req.header("CF-Connecting-IP") ?? "anonymous";
      const { success } = await limiter.limit({ key });
      if (!success) {
        c.header("Retry-After", "60");
        return c.json({ error: "Too many requests. Please wait a minute and try again.", code: "rate_limited" }, 429);
      }
    }
    await next();
  };
}
