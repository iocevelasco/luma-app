/**
 * reCAPTCHA v3 Service
 * 
 * This service handles reCAPTCHA v3 integration for the frontend.
 * reCAPTCHA v3 runs in the background and provides a score (0.0 to 1.0)
 * without interrupting the user experience.
 */

import { shouldEnableRecaptcha } from '@luma/shared';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

/**
 * Loads the reCAPTCHA script dynamically
 */
export function loadRecaptchaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (window.grecaptcha) {
      resolve();
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
    if (existingScript) {
      // Wait for grecaptcha to be available
      const checkInterval = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.grecaptcha) {
          reject(new Error('reCAPTCHA script failed to load'));
        }
      }, 10000);
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait for grecaptcha to be available
      const checkInterval = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.grecaptcha) {
          reject(new Error('reCAPTCHA script failed to initialize'));
        }
      }, 10000);
    };

    script.onerror = () => {
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Executes reCAPTCHA v3 and returns a token
 * @param action - The action name (e.g., 'login', 'register', 'submit')
 * @returns Promise<string> - The reCAPTCHA token
 */
export async function executeRecaptcha(action: string): Promise<string> {
  const hostname = window.location.hostname;
  
  // Skip reCAPTCHA in development/localhost
  if (!shouldEnableRecaptcha(hostname)) {
    console.log(`ℹ️  [RECAPTCHA] Skipping reCAPTCHA in development mode (hostname: ${hostname})`);
    return '';
  }

  if (!RECAPTCHA_SITE_KEY) {
    console.warn('⚠️  [RECAPTCHA] Site key is not configured. Skipping reCAPTCHA verification.');
    return '';
  }

  try {
    console.log(`🔍 [RECAPTCHA] Starting token generation for action: ${action}`);
    console.log(`📍 [RECAPTCHA] Current domain: ${window.location.hostname}`);
    
    // Ensure script is loaded
    await loadRecaptchaScript();
    console.log(`✅ [RECAPTCHA] Script loaded successfully`);

    return new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        const currentHostname = window.location.hostname;
        const currentOrigin = window.location.origin;
        const isHttps = window.location.protocol === 'https:';
        
        console.log(`🔄 [RECAPTCHA] Executing reCAPTCHA with site key: ${RECAPTCHA_SITE_KEY.substring(0, 10)}...`);
        console.log(`📍 [RECAPTCHA] Context:`, {
          hostname: currentHostname,
          origin: currentOrigin,
          protocol: window.location.protocol,
          isHttps,
          action,
        });
        
        window.grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action })
          .then((token: string) => {
            if (!token || token.trim() === '') {
              console.error('❌ [RECAPTCHA] Token is empty');
              reject(new Error('reCAPTCHA token is empty'));
              return;
            }
            console.log(`✅ [RECAPTCHA] Token generated successfully for action: ${action}`, {
              tokenLength: token.length,
              tokenPreview: token.substring(0, 20) + '...',
              domain: currentHostname,
              origin: currentOrigin,
              protocol: window.location.protocol,
            });
            resolve(token);
          })
          .catch((error: Error) => {
            console.error('❌ [RECAPTCHA] Execution error:', error);
            console.error('💡 [RECAPTCHA] Troubleshooting:', {
              siteKeyConfigured: !!RECAPTCHA_SITE_KEY,
              siteKeyPreview: RECAPTCHA_SITE_KEY ? RECAPTCHA_SITE_KEY.substring(0, 10) + '...' : 'not set',
              domain: currentHostname,
              origin: currentOrigin,
              protocol: window.location.protocol,
              isHttps,
              action,
            });
            reject(error);
          });
      });
    });
  } catch (error) {
    console.error('❌ [RECAPTCHA] Error:', error);
    // Re-throw the error instead of returning empty string
    // This will prevent sending empty tokens to the backend
    throw error;
  }
}

/**
 * Checks if reCAPTCHA is enabled
 * reCAPTCHA is only enabled in production environments
 */
export function isRecaptchaEnabled(): boolean {
  const hostname = window.location.hostname;
  
  // Only enable reCAPTCHA in production and if site key is configured
  if (!shouldEnableRecaptcha(hostname)) {
    return false;
  }
  
  return !!RECAPTCHA_SITE_KEY;
}

