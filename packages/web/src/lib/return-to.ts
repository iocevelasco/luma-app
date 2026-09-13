/**
 * Post-login return-to handling.
 *
 * When an unauthenticated user hits a protected route (e.g. a deep link to a
 * protected route with query params), we bounce them to the login page but
 * remember where they were headed so we can send them back after they authenticate.
 *
 * The destination travels as a `?returnTo=` query param and is always validated
 * with {@link sanitizeReturnTo} to prevent open-redirect.
 */

export const RETURN_TO_PARAM = 'returnTo';
/**
 * Returns `raw` only if it is a safe, same-origin internal path — it must start
 * with a single `/` and must not be a protocol-relative (`//host`) or
 * backslash-tricked (`/\host`) URL that a browser can resolve to an external
 * origin. Anything else (absolute URLs, empty, non-string) yields `null`.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  // Must be an absolute internal path whose 2nd char is neither "/" nor "\".
  // Covers "//evil.com", "/\evil.com" and their encoded forms (searchParams and
  // sessionStorage both hand us the already-decoded value).
  return /^\/(?![/\\])/.test(raw) ? raw : null;
}

/** Reads and sanitizes the returnTo param from a location search string. */
export function readReturnTo(search: string): string | null {
  return sanitizeReturnTo(new URLSearchParams(search).get(RETURN_TO_PARAM));
}

/**
 * Builds the login path carrying the current location as returnTo, e.g.
 * `/login?returnTo=%2Fadmin%3Ftab%3Dx`. Pass the full internal path
 * (`pathname + search`).
 */
export function buildLoginPathWithReturn(loginPath: string, currentFullPath: string): string {
  const safe = sanitizeReturnTo(currentFullPath);
  if (!safe) return loginPath;
  return `${loginPath}?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}`;
}
