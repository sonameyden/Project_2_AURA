import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlaylistWithRole, roleFor, updatePlaylistAtomically } from "../src/lib/playlistAccess";
import { appendUnique, mergeOrder } from "../src/lib/playlistOrder";

/**
 * A tiny in-memory stand-in for the parts of supabase-js the access helpers
 * use: from(table).select().eq()...maybeSingle(), and update().eq().select().
 */
function fakeSupabase(tables: Record<string, Record<string, any>[]>) {
  const query = (table: string) => {
    const filters: [string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    const rows = () => (tables[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value));
    const builder: any = {
      select: () => builder,
      eq: (key: string, value: unknown) => {
        filters.push([key, value]);
        return builder;
      },
      update: (values: Record<string, unknown>) => {
        patch = values;
        return builder;
      },
      maybeSingle: async () => {
        const matches = rows();
        if (patch) matches.forEach((row) => Object.assign(row, patch));
        return { data: matches[0] ?? null, error: null };
      },
      single: async () => builder.maybeSingle(),
    };
    return builder;
  };
  return { from: query } as unknown as SupabaseClient;
}

const playlists = () => ({
  playlists: [
    { id: "private", owner_id: "owner", is_public: false, song_ids: ["a", "b"], version: 0 },
    { id: "public", owner_id: "owner", is_public: true, song_ids: [], version: 0 },
  ],
  playlist_collaborators: [
    { playlist_id: "private", user_id: "editor", role: "editor" },
    { playlist_id: "private", user_id: "viewer", role: "viewer" },
  ],
});

describe("playlist authorisation", () => {
  it("gives each person the right role on a private playlist", async () => {
    const db = fakeSupabase(playlists());
    const row = (await db.from("playlists").select("*").eq("id", "private").maybeSingle()).data;
    expect(await roleFor(db, row, "owner")).toBe("owner");
    expect(await roleFor(db, row, "editor")).toBe("editor");
    expect(await roleFor(db, row, "viewer")).toBe("viewer");
    expect(await roleFor(db, row, "stranger")).toBeNull();
  });

  it("hides private playlists from strangers but shows public ones", async () => {
    const db = fakeSupabase(playlists());
    expect(await findPlaylistWithRole(db, "private", "stranger", "viewer")).toBeNull();
    expect((await findPlaylistWithRole(db, "public", "stranger", "viewer"))?.role).toBe("viewer");
  });

  it("does not let viewers edit or editors manage sharing", async () => {
    const db = fakeSupabase(playlists());
    expect(await findPlaylistWithRole(db, "private", "viewer", "editor")).toBeNull();
    expect(await findPlaylistWithRole(db, "private", "editor", "editor")).not.toBeNull();
    expect(await findPlaylistWithRole(db, "private", "editor", "owner")).toBeNull();
    expect(await findPlaylistWithRole(db, "public", "stranger", "editor")).toBeNull();
  });

  it("bumps the version on every saved change", async () => {
    const tables = playlists();
    const db = fakeSupabase(tables);
    await updatePlaylistAtomically(db, "private", (current) => ({ song_ids: appendUnique(current.song_ids, ["c"]) }));
    expect(tables.playlists[0]).toMatchObject({ song_ids: ["a", "b", "c"], version: 1 });
  });
});

describe("concurrent playlist edits", () => {
  it("keeps songs another editor added while you reordered", () => {
    // You loaded [a, b, c] and moved c to the top; meanwhile someone added d and removed b.
    expect(mergeOrder(["a", "c", "d"], ["c", "a", "b"])).toEqual(["c", "a", "d"]);
  });

  it("ignores duplicates and unknown ids", () => {
    expect(mergeOrder(["a", "b"], ["b", "b", "zzz", "a"])).toEqual(["b", "a"]);
    expect(appendUnique(["a"], ["a", "b"])).toEqual(["a", "b"]);
  });
});
