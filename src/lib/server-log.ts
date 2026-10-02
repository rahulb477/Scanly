import "server-only";

/**
 * Server-only structured logging.
 *
 * Vercel server logs are the only place the real cause of a failed request may
 * be recorded, so every failure path logs the underlying error there. Nothing
 * here is ever returned to the browser: the matching API responses stay generic.
 *
 * Redaction is deliberate and defensive. Even though callers only ever pass
 * error objects, these scrubbers guarantee that a private key, a Firebase ID
 * token, a session cookie or a service-account email can never reach a log line
 * if a library ever embeds one in an error message.
 */

const REDACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g, "[redacted-private-key]"],
  [/-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/g, "[redacted-pem]"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, "[redacted-token]"],
  [/\b(?:private[_-]?key|privateKey)\b\s*[:=]\s*"[^"]*"/g, "[redacted-private-key]"],
  [/[\w.+-]+@[\w-]+\.iam\.gserviceaccount\.com/g, "[redacted-service-account]"],
];

export function scrub(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  let output = text;
  for (const [pattern, replacement] of REDACTIONS) output = output.replace(pattern, replacement);
  return output.length > 500 ? `${output.slice(0, 500)}…[truncated]` : output;
}

/** Safe, structured details for an unknown thrown value. Never includes a stack trace (it can embed values). */
export function errorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error, message: scrub(error) };
  const record = error as Error & { code?: unknown; details?: unknown; reason?: unknown; type?: unknown };
  const details: Record<string, unknown> = { name: error.name, message: scrub(error.message) };
  if (typeof record.code === "string" || typeof record.code === "number") details.code = record.code;
  if (typeof record.type === "string") details.type = record.type;
  if (typeof record.details === "string") details.details = scrub(record.details);
  if (typeof record.reason === "string") details.reason = scrub(record.reason);
  return details;
}

/**
 * Writes one structured line to the server log. `fields` must only ever contain
 * non-secret identifiers (stage, uid, project ids, durations, safe flags).
 */
export function serverLog(scope: string, message: string, fields: Record<string, unknown> = {}): void {
  console.error(`[scanly:${scope}] ${message} ${JSON.stringify(fields)}`);
}

/** Logs a failure with its real cause, and returns nothing so callers can map it to a safe response. */
export function logServerError(scope: string, stage: string, error: unknown, fields: Record<string, unknown> = {}): void {
  serverLog(scope, `stage=${stage} failed`, { stage, ...fields, ...errorDetails(error) });
}
