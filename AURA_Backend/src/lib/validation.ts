import type { Context } from "hono";

/**
 * Input helpers shared by the route files. Anything a user types that ends up
 * inside a PostgREST filter string goes through one of these first.
 */

const MAX_SEARCH_LENGTH = 100;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Escapes LIKE wildcards (`\`, `%`, `_`) so user text matches literally, and
 * drops `*` (PostgREST treats it as a `%` alias in like/ilike patterns).
 * Use with `.ilike(column, ...)` for a case-insensitive exact match.
 */
export function likeExact(value: string): string {
  return value
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/\*/g, "")
    .replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** `%term%` pattern for `.ilike(column, ...)` "contains" searches. */
export function likeContains(value: string): string {
  return `%${likeExact(value)}%`;
}

/**
 * Wraps a filter value in double quotes for use inside `.or("col.op.value,...")`
 * strings, so `,`, `(`, `)`, `.` and `:` in user text can't break out of the
 * value or add extra filters. PostgREST unescapes `\` and `"` inside quotes.
 */
export function orFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (character) => `\\${character}`)}"`;
}

/**
 * Keeps only well-formed ids (letters, digits, `_`, `-`; max 128 chars),
 * de-duplicated in order. Use before interpolating ids into `not.in.(...)`
 * filter strings.
 */
export function sanitizeIds(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item === "string" && SAFE_ID.test(item)) ids.add(item);
    if (ids.size >= max) break;
  }
  return [...ids];
}

/** Non-empty strings from an untrusted array, de-duplicated in order. */
export function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

/**
 * Parses a JSON object body. Returns null for malformed JSON or a non-object
 * body so the route can answer 400 instead of throwing a 500.
 */
export async function readJsonBody<T extends object>(c: Context): Promise<Partial<T> | null> {
  try {
    const body: unknown = await c.req.json();
    return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function invalidJsonResponse(c: Context) {
  return c.json({ error: "Request body must be a JSON object" }, 400);
}
