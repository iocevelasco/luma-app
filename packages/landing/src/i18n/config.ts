import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es/translation.json';

type Lang = 'es' | 'pt';

/**
 * Sólo `es` viaja en el bundle principal. El portugués es un chunk aparte que
 * se descarga si la persona lo tiene como idioma o lo elige: quien entra en
 * español no paga por un diccionario que no va a leer.
 */
async function ensureLanguage(lng: Lang) {
  if (lng === 'es' || i18n.hasResourceBundle(lng, 'translation')) return;
  const bundle = await import('./locales/pt/translation.json');
  i18n.addResourceBundle('pt', 'translation', bundle.default, true, true);
}

export async function switchLanguage(lng: Lang) {
  await ensureLanguage(lng);
  await i18n.changeLanguage(lng);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es } },
    partialBundledLanguages: true,
    fallbackLng: 'es',
    supportedLngs: ['es', 'pt'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => (lng.startsWith('pt') ? 'pt' : 'es'),
    },
  })
  .then(() => {
    // Detectado `pt` pero sin diccionario todavía: mostramos es y, al llegar
    // el chunk, re-emitimos el cambio de idioma para que React re-renderice.
    if (i18n.language === 'pt') void switchLanguage('pt');
  });

export default i18n;
