export const SESSION_COOKIE_NAME = "tako_session"

/**
 * Sets the authentication session cookie in the browser.
 */
export function setSessionCookie(sessionId: string = "sess_active"): void {
  if (typeof document !== "undefined") {
    const maxAge = 60 * 60 * 24 * 7 // 7 days in seconds
    document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; path=/; max-age=${maxAge}; SameSite=Lax`
  }
}

/**
 * Clears the authentication session cookie in the browser upon logout.
 */
export function clearSessionCookie(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
  }
}
