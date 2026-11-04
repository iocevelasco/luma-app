import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import esTranslations from './locales/es/translation.json';
import esESTranslations from './locales/es-ES/translation.json';
import ptTranslations from './locales/pt/translation.json';

i18n
  .use(LanguageDetector) // Detecta el idioma del navegador
  .use(initReactI18next) // Pasa i18n a react-i18next
  .init({
    resources: {
      'es-AR': {
        translation: esTranslations,
      },
      'es-ES': {
        translation: esESTranslations, // Español de España: tuteo y vocabulario peninsular
      },
      es: {
        translation: esESTranslations, // Español genérico: el de España
      },
      'pt-BR': {
        translation: ptTranslations,
      },
      pt: {
        translation: ptTranslations, // Fallback para portugués genérico
      },
    },
    fallbackLng: 'es-ES', // Idioma por defecto: español de España
    supportedLngs: ['es-AR', 'es-ES', 'es', 'pt-BR', 'pt'], // Idiomas soportados
    debug: false,
    interpolation: {
      escapeValue: false, // React ya escapa los valores
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Normalizar idiomas detectados a nuestras variantes
      convertDetectedLanguage: (lng: string) => {
        const code = lng.toLowerCase();
        // El argentino sólo si el navegador lo pide. El resto del español
        // (es, es-ES, es-419, es-MX, es-VE…) va al de España.
        if (code === 'es-ar') {
          return 'es-AR';
        }
        if (code.startsWith('es')) {
          return 'es-ES';
        }
        if (code.startsWith('pt')) {
          return 'pt-BR';
        }
        return 'es-ES';
      },
    },
  });

export default i18n;

