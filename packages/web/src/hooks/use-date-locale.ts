import { useTranslation } from 'react-i18next';
import { es, ptBR, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const LOCALE_MAP: Record<string, Locale> = {
  'es-AR': es,
  'es': es,
  'pt-BR': ptBR,
  'pt': ptBR,
  'en': enUS,
};

export function useDateLocale(): Locale {
  const { i18n } = useTranslation();
  return LOCALE_MAP[i18n.language] ?? LOCALE_MAP[i18n.language?.split('-')[0]] ?? es;
}
