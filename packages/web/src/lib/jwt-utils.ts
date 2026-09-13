/**
 * Utility functions for JWT token handling
 */

/**
 * Decode JWT token without verification (client-side only)
 * This is safe to use for reading expiration time and payload
 */
export function decodeJWT(token: string): { exp?: number; iat?: number; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Check if a JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return true; // Consider expired if we can't decode or no exp claim
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = decoded.exp * 1000;
  const currentTime = Date.now();

  return currentTime >= expirationTime;
}

/**
 * Get token expiration time in milliseconds
 */
export function getTokenExpirationTime(token: string): number | null {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return null;
  }

  // exp is in seconds, convert to milliseconds
  return decoded.exp * 1000;
}

/**
 * Get time remaining until token expiration in milliseconds
 */
export function getTokenTimeRemaining(token: string): number | null {
  const expirationTime = getTokenExpirationTime(token);
  if (expirationTime === null) {
    return null;
  }

  const remaining = expirationTime - Date.now();
  return remaining > 0 ? remaining : 0;
}

