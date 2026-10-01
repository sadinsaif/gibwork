const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Accept a bare task UUID or a full gib.work URL and return the UUID.
 * Throws if no UUID can be found.
 */
export function parseTaskId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(UUID_RE);
  if (m) return m[0].toLowerCase();
  throw new Error(`Not a valid Gibwork task id or URL: "${input}"`);
}

export function looksLikeTaskId(input: string): boolean {
  return UUID_RE.test(input.trim());
}
