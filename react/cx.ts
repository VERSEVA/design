/** Joins class names, skipping falsy values. The only utility the kit needs. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
