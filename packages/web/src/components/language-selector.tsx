import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/**
 * Selector de idioma. Vive en el header, así que el disparador muestra la
 * abreviatura y el nombre completo queda para las opciones: un trigger con
 * "Español (Argentina)" se come el ancho de la barra y termina truncado.
 */
const LANGUAGES = [
  { value: 'es-AR', short: 'ES', label: 'Español (Argentina)' },
  { value: 'pt-BR', short: 'PT', label: 'Português (Brasil)' },
] as const;

export function LanguageSelector() {
  const { t, i18n } = useTranslation();

  const current = i18n.language.startsWith('pt') ? 'pt-BR' : 'es-AR';
  const short = LANGUAGES.find((l) => l.value === current)?.short ?? 'ES';

  return (
    <Select value={current} onValueChange={(lang) => i18n.changeLanguage(lang)}>
      <SelectTrigger className="w-auto gap-1 border-0 bg-transparent shadow-none" aria-label={t('common.language')}>
        <SelectValue>{short}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {LANGUAGES.map((language) => (
          <SelectItem key={language.value} value={language.value}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
