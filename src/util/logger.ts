/**
 * Minimal output helpers.
 *
 * Convention (mirrors the official Gibwork CLI):
 *   - Machine-readable JSON goes to STDOUT as a stable envelope.
 *   - Human prompts, warnings, progress go to STDERR so `--json`
 *     output on stdout is never polluted.
 */

let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = on;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** Human-facing line. Suppressed in --json mode (keeps stdout clean for JSON). */
export function info(msg: string): void {
  if (!jsonMode) process.stderr.write(msg + '\n');
}

/** Always to stderr; shown even in JSON mode. */
export function warn(msg: string): void {
  process.stderr.write(msg + '\n');
}

export function errline(msg: string): void {
  process.stderr.write(msg + '\n');
}

/** Emit the stable success envelope to stdout. */
export function emitJson(data: unknown): void {
  process.stdout.write(JSON.stringify({ ok: true, data }, null, 2) + '\n');
}

/** Emit the stable error envelope to stdout. */
export function emitJsonError(code: string, message: string): void {
  process.stdout.write(JSON.stringify({ ok: false, error: { code, message } }, null, 2) + '\n');
}

// Small ANSI helpers (no dependency). Disabled when NO_COLOR is set or not a TTY.
const useColor = !process.env.NO_COLOR && process.stderr.isTTY;
const wrap = (code: string) => (s: string | number) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : String(s));
export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
};
