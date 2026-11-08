import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { allowedOrigins, corsMiddleware } from "../src/lib/cors";
import { rateLimit } from "../src/lib/rateLimit";
import type { AppEnv } from "../src/lib/context";

const devEnv = { ENVIRONMENT: "development" } as any;

function corsApp() {
  const app = new Hono<any>();
  app.use("*", corsMiddleware);
  app.patch("/library/playlists/p1", (c) => c.json({ ok: true }));
  return app;
}

describe("CORS", () => {
  it("allows the Expo web dev server, including PATCH (used for playlist edits)", async () => {
    const res = await corsApp().request(
      "/library/playlists/p1",
      { method: "OPTIONS", headers: { Origin: "http://localhost:8081" } },
      devEnv,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
  });

  it("never answers with a wildcard, and gives unknown sites no access", async () => {
    const res = await corsApp().request(
      "/library/playlists/p1",
      { method: "PATCH", headers: { Origin: "https://evil.example" } },
      devEnv,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("leaves the phone app (no Origin header) unaffected", async () => {
    const res = await corsApp().request("/library/playlists/p1", { method: "PATCH" }, devEnv);
    expect(res.status).toBe(200);
  });

  it("uses ALLOWED_ORIGINS when set, and nothing by default in production", () => {
    expect(allowedOrigins({ ENVIRONMENT: "production", ALLOWED_ORIGINS: "https://a.app, https://b.app" })).toEqual([
      "https://a.app",
      "https://b.app",
    ]);
    expect(allowedOrigins({ ENVIRONMENT: "production" })).toEqual([]);
  });
});

/** A stand-in for Cloudflare's rate limiter: allows `limit` calls per key. */
function fakeLimiter(limit: number) {
  const counts = new Map<string, number>();
  return {
    limit: async ({ key }: { key: string }) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { success: next <= limit };
    },
  };
}

function limitedApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { uid: c.req.header("x-test-user") ?? "user-a", email: null } as any);
    await next();
  });
  app.use("/discover/search", rateLimit("AI_RATE_LIMITER"));
  app.get("/discover/search", (c) => c.json({ ok: true }));
  return app;
}

describe("rate limiting", () => {
  it("returns 429 with a clear message once a user goes over the limit", async () => {
    const env = { AI_RATE_LIMITER: fakeLimiter(2) } as any;
    const app = limitedApp();
    expect((await app.request("/discover/search", {}, env)).status).toBe(200);
    expect((await app.request("/discover/search", {}, env)).status).toBe(200);
    const blocked = await app.request("/discover/search", {}, env);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(await blocked.json()).toMatchObject({ code: "rate_limited" });
  });

  it("counts each user separately", async () => {
    const env = { AI_RATE_LIMITER: fakeLimiter(1) } as any;
    const app = limitedApp();
    expect((await app.request("/discover/search", { headers: { "x-test-user": "a" } }, env)).status).toBe(200);
    expect((await app.request("/discover/search", { headers: { "x-test-user": "b" } }, env)).status).toBe(200);
    expect((await app.request("/discover/search", { headers: { "x-test-user": "a" } }, env)).status).toBe(429);
  });

  it("lets requests through when no limiter is configured", async () => {
    expect((await limitedApp().request("/discover/search", {}, {} as any)).status).toBe(200);
  });
});
