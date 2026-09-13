import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import esTranslations from './locales/es/translation.json';
import ptTranslations from './locales/pt/translation.json';

i18n
  .use(LanguageDetector) // Detecta el idioma del navegador
  .use(initReactI18next) // Pasa i18n a react-i18next
  .init({
    resources: {
      'es-AR': {
        translation: esTranslations,
      },
      es: {
        translation: esTranslations, // Fallback para español genérico
      },
      'pt-BR': {
        translation: ptTranslations,
      },
      pt: {
        translation: ptTranslations, // Fallback para portugués genérico
      },
    },
    fallbackLng: 'es-AR', // Idioma por defecto: Español Latinoamericano (Argentina)
    supportedLngs: ['es-AR', 'es', 'pt-BR', 'pt'], // Idiomas soportados
    debug: false,
    interpolation: {
      escapeValue: false, // React ya escapa los valores
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Normalizar idiomas detectados a nuestras variantes
      convertDetectedLanguage: (lng: string) => {
        // Si detecta español, usar es-AR
        if (lng.startsWith('es')) {
          return 'es-AR';
        }
        // Si detecta portugués, usar pt-BR
        if (lng.startsWith('pt')) {
          return 'pt-BR';
        }
        // Por defecto, usar es-AR
        return 'es-AR';
      },
    },
  });

export default i18n;

