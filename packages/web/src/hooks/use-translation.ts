import { useTranslation as useI18nTranslation } from 'react-i18next';

/**
 * Hook personalizado para usar traducciones
 * Proporciona acceso a la función t y al objeto i18n
 */
export function useTranslation() {
  return useI18nTranslation();
}

