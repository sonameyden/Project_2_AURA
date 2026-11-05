import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import type { Env } from "../types";

/**
 * Verifies the Firebase ID token the Android app attaches as
 * `Authorization: Bearer <token>` (see core/data/di/NetworkModule.kt's
 * provideAuthInterceptor on the Android side).
 *
 * This verifies the JWT's signature against Google's public keys for
 * Firebase — it does NOT need the Firebase Admin SDK (which isn't
 * Workers-compatible), just standard JWT verification against Firebase's
 * published JWKS endpoint.
 */
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export interface AuthedContext {
  uid: string;
  email: string | null;
}

type AuthContext = { Bindings: Env; Variables: { auth: AuthedContext } };

/**
 * Hono middleware — verifies the token and attaches { uid, email } to
 * c.set("auth", ...). Rejects with 401 if missing/invalid/expired.
 *
 * Apply this to any route that should require a logged-in user. Left OFF
 * public/dev seed data reads in this starter — decide per-route which
 * ones actually need it before a public deployment.
 */
export async function requireAuth(c: Context<AuthContext>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  const token = authHeader.slice("Bearer ".length);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID}`,
      audience: c.env.FIREBASE_PROJECT_ID,
    });

    const uid = payload.sub;
    if (!uid) return c.json({ error: "Invalid token — no subject" }, 401);

    c.set("auth", { uid, email: (payload.email as string | undefined) ?? null } satisfies AuthedContext);
    await next();
  } catch (e) {
    return c.json({ error: `Invalid or expired token: ${(e as Error).message}` }, 401);
  }
}
