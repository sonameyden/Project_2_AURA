import type { Env } from "../types";
import type { AuthedContext } from "./firebaseAuth";

/**
 * Hono environment for every authenticated route group: Worker bindings plus
 * the `{ uid, email }` that `requireAuth` attaches with `c.set("auth", ...)`.
 */
export interface AppEnv {
  Bindings: Env;
  Variables: { auth: AuthedContext };
}
