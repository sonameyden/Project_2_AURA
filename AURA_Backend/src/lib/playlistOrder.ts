/**
 * Applies a requested song order on top of the playlist's *current* songs.
 * If someone else added or removed songs since the client loaded the list,
 * their change is kept: removed songs stay removed, and newly added songs are
 * appended after the requested order (last write wins for the order itself).
 */
export function mergeOrder(current: string[], requested: string[]): string[] {
  const present = new Set(current);
  const ordered = [...new Set(requested)].filter((id) => present.has(id));
  const placed = new Set(ordered);
  return [...ordered, ...current.filter((id) => !placed.has(id))];
}

/** Adds ids that aren't already present, keeping existing order. */
export function appendUnique(current: string[], additions: string[]): string[] {
  return [...new Set([...current, ...additions])];
}
