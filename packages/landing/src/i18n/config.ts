import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es/translation.json';
import pt from './locales/pt/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      pt: { translation: pt },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'pt'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => (lng.startsWith('pt') ? 'pt' : 'es'),
    },
  });

export default i18n;
