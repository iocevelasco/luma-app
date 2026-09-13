import { useCallback } from 'react';
import { executeRecaptcha, isRecaptchaEnabled } from '@/lib/recaptcha';

/**
 * React hook for using reCAPTCHA v3
 * 
 * @example
 * const { executeRecaptchaAction } = useRecaptcha();
 * 
 * const handleSubmit = async () => {
 *   const token = await executeRecaptchaAction('submit');
 *   // Send token to backend with form data
 * };
 */
export function useRecaptcha() {
  const executeRecaptchaAction = useCallback(async (action: string): Promise<string> => {
    // executeRecaptcha already handles development/production logic
    // It will return empty string in development and execute in production
    return executeRecaptcha(action);
  }, []);

  return {
    executeRecaptchaAction,
    isEnabled: isRecaptchaEnabled(),
  };
}

