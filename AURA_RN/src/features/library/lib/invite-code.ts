/**
 * Pulls the invite code out of whatever someone pastes: the whole share message,
 * a web link (`https://…/invite/<code>`), an app link (`aura://invite/<code>`,
 * `exp://…/--/invite/<code>`) or just the code itself.
 */
export function parseInviteCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromLink = /invite\/([A-Za-z0-9_-]+)/.exec(text);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9_-]{6,}$/.test(text) ? text : null;
}
