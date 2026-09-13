/**
 * reCAPTCHA v3 Verification Service
 * 
 * This service verifies reCAPTCHA tokens on the backend.
 * reCAPTCHA v3 returns a score (0.0 to 1.0) where:
 * - 1.0 is very likely a good interaction
 * - 0.0 is very likely a bot
 * 
 * Recommended threshold: 0.5 (default)
 */

import { RECAPTCHA_CONFIG, isProduction as isProductionEnv } from '../config/app.config.js';


const RECAPTCHA_SECRET_KEY = RECAPTCHA_CONFIG.SECRET_KEY;
const RECAPTCHA_VERIFY_URL = RECAPTCHA_CONFIG.VERIFY_URL;
const DEFAULT_THRESHOLD = RECAPTCHA_CONFIG.DEFAULT_THRESHOLD;

export interface RecaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  error?: string;
}

interface RecaptchaApiResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verifies a reCAPTCHA token with Google's API
 * @param token - The reCAPTCHA token from the frontend
 * @param expectedAction - The expected action name (e.g., 'login', 'register')
 * @param threshold - Minimum score to accept (default: 0.5)
 * @returns Promise<RecaptchaVerificationResult>
 */
export async function verifyRecaptchaToken(
  token: string | undefined,
  expectedAction?: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<RecaptchaVerificationResult> {
  // Skip reCAPTCHA verification in development or when SKIP_RECAPTCHA=true (e.g. staging E2E)
  if (!isProductionEnv || process.env.SKIP_RECAPTCHA === 'true') {
    console.log('ℹ️  [RECAPTCHA] Skipping verification in development/test mode');
    return { success: true };
  }

  // In production, reCAPTCHA is required
  if (!RECAPTCHA_SECRET_KEY) {
    console.error('❌ [RECAPTCHA] Secret key not configured in production. This is required!');
    return {
      success: false,
      error: 'reCAPTCHA is not configured on the server',
    };
  }

  // If no token provided in production, reject
  if (!token || token.trim() === '') {
    console.warn('⚠️  [RECAPTCHA] No token provided in production');
    return {
      success: false,
      error: 'reCAPTCHA token is required',
    };
  }

  try {
    // Log verification attempt (without exposing secret key)
    console.log(`🔍 [RECAPTCHA] Verifying token for action: ${expectedAction || 'any'}`);
    console.log(`🔑 [RECAPTCHA] Secret key configured: ${!!RECAPTCHA_SECRET_KEY}`);
    console.log(`🔑 [RECAPTCHA] Secret key preview: ${RECAPTCHA_SECRET_KEY ? RECAPTCHA_SECRET_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    
    // Verify token with Google
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    if (!response.ok) {
      console.error(`❌ [RECAPTCHA] HTTP error: ${response.status} ${response.statusText}`);
      return {
        success: false,
        error: `reCAPTCHA API returned HTTP ${response.status}`,
      };
    }

    const data = await response.json() as RecaptchaApiResponse;

    if (!data.success) {
      const errorCodes = data['error-codes'] || [];
      console.warn('⚠️  [RECAPTCHA] Verification failed:', {
        errorCodes,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...',
        hostname: data.hostname,
        challenge_ts: data.challenge_ts,
        action: data.action,
      });
      
      // Handle specific error codes
      if (errorCodes.includes('invalid-input-response')) {
        // invalid-input-response usually means:
        // 1. Token is invalid, expired, or already used
        // 2. Domain not configured in reCAPTCHA console
        // 3. Token was generated from a different domain
        // 4. Hostname is undefined (domain mismatch or configuration issue)
        const hostname = data.hostname || 'unknown';
        console.error('❌ [RECAPTCHA] Invalid input response:', {
          message: 'Token is invalid or domain not configured in reCAPTCHA console',
          tokenHostname: hostname,
          tokenLength: token.length,
          secretKeyConfigured: !!RECAPTCHA_SECRET_KEY,
          action: expectedAction,
          receivedAction: data.action,
          errorCodes,
          challenge_ts: data.challenge_ts,
        });
        
        // If hostname is undefined, it means Google couldn't determine the domain
        // This usually happens when:
        // 1. The domain in the token doesn't match any configured domain
        // 2. The token was generated from a different origin
        // 3. There's a mismatch between the site key and secret key (MOST COMMON)
        if (!data.hostname || data.hostname === 'unknown') {
          console.error('❌ [RECAPTCHA] Hostname is undefined - this indicates a KEY MISMATCH issue');
          console.error('💡 [RECAPTCHA] MOST LIKELY CAUSE: Site key and Secret key are from DIFFERENT reCAPTCHA sites');
          console.error('💡 [RECAPTCHA] Troubleshooting steps:');
          console.error('   1. ⚠️  CRITICAL: Verify that VITE_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY are from the SAME site');
          console.error('      - Go to https://www.google.com/recaptcha/admin');
          console.error('      - Select your reCAPTCHA site');
          console.error('      - Copy BOTH keys from the SAME site');
          console.error('   2. Verify that the production domain (<DOMINIO>) is added in reCAPTCHA console');
          console.error('   3. Update the env vars in Coolify with the correct keys:');
          console.error('      VITE_RECAPTCHA_SITE_KEY=<site_key_from_console>');
          console.error('      RECAPTCHA_SECRET_KEY=<secret_key_from_console>');
          console.error('   4. Redeploy after updating them: pnpm deploy');
        }
        
        return {
          success: false,
          error: `reCAPTCHA verification failed: invalid-input-response. Please verify:\n1. Domain "${hostname}" is added in reCAPTCHA console\n2. Site key and secret key match (from the same reCAPTCHA site)\n3. Token was generated recently (tokens expire after 2 minutes)\n4. The domain in reCAPTCHA console matches exactly: <DOMINIO>`,
        };
      }
      
      if (errorCodes.includes('browser-error')) {
        // browser-error usually means:
        // 1. Domain not configured in reCAPTCHA console
        // 2. Hostname mismatch between token generation and verification
        // 3. Token generated from different domain than expected
        console.error('❌ [RECAPTCHA] Browser error details:', {
          message: 'This usually means the domain is not configured in reCAPTCHA console',
          expectedDomains: 'Make sure "localhost" and "127.0.0.1" are added to allowed domains',
          tokenHostname: data.hostname,
          secretKeyConfigured: !!RECAPTCHA_SECRET_KEY,
        });
        
        // In development, provide more helpful error message
        if (!isProductionEnv) {
          return {
            success: false,
            error: `reCAPTCHA browser error. Please verify:\n1. Domain "localhost" is added in reCAPTCHA console\n2. Site key and secret key match\n3. Token was generated from the correct domain (hostname: ${data.hostname || 'unknown'})`,
          };
        }
        
        return {
          success: false,
          error: 'reCAPTCHA browser error. Please refresh the page and try again.',
        };
      }
      
      return {
        success: false,
        error: `reCAPTCHA verification failed: ${errorCodes.join(', ') || 'Unknown error'}`,
      };
    }

    // Verify action matches (if expected)
    if (expectedAction && data.action !== expectedAction) {
      console.warn(`⚠️  [RECAPTCHA] Action mismatch. Expected: ${expectedAction}, Got: ${data.action}`);
      return {
        success: false,
        error: `reCAPTCHA action mismatch. Expected: ${expectedAction}, Got: ${data.action}`,
        action: data.action,
      };
    }

    // Check score
    const score = data.score || 0;
    if (score < threshold) {
      console.warn(`⚠️  [RECAPTCHA] Score too low: ${score} (threshold: ${threshold})`);
      return {
        success: false,
        score,
        action: data.action,
        error: `reCAPTCHA score too low: ${score} (minimum: ${threshold})`,
      };
    }

    console.log(`✅ [RECAPTCHA] Verification successful. Score: ${score}, Action: ${data.action}`);
    return {
      success: true,
      score,
      action: data.action,
    };
  } catch (error) {
    console.error('❌ [RECAPTCHA] Verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during reCAPTCHA verification',
    };
  }
}

/**
 * Middleware helper to verify reCAPTCHA token from request body
 * @param req - Express request object
 * @param expectedAction - The expected action name
 * @param threshold - Minimum score to accept (default: 0.5)
 * @returns Promise<RecaptchaVerificationResult>
 */
export async function verifyRecaptchaFromRequest(
  req: { body: { recaptchaToken?: string } },
  expectedAction?: string,
  threshold: number = DEFAULT_THRESHOLD
): Promise<RecaptchaVerificationResult> {
  const token = req.body.recaptchaToken;
  return verifyRecaptchaToken(token, expectedAction, threshold);
}

