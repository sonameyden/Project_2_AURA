/** True for a `#RRGGBB` colour string (the format the atmosphere engine returns). */
export function isHexColor(value: string | undefined | null): value is string {
  return Boolean(value && /^#[\da-f]{6}$/i.test(value));
}
