import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/**
 * Selector de idioma. Vive en Mi cuenta (la app se usa en Venezuela y el idioma
 * se toca una vez, no a diario). En el header —`variant="header"`— el disparador
 * muestra la abreviatura: un trigger con "Español (Argentina)" se come el ancho
 * de la barra y termina truncado. En un formulario —`"form"`— muestra el nombre.
 */
const LANGUAGES = [
  { value: 'es-AR', short: 'ES-AR', label: 'Español (Argentina)' },
  { value: 'es-ES', short: 'ES-ES', label: 'Español (España)' },
  { value: 'pt-BR', short: 'PT', label: 'Português (Brasil)' },
] as const;

export function LanguageSelector({ variant = 'header' }: { variant?: 'header' | 'form' }) {
  const { t, i18n } = useTranslation();

  const current = i18n.language.startsWith('pt')
    ? 'pt-BR'
    : i18n.language === 'es-AR'
      ? 'es-AR'
      : 'es-ES';
  const selected = LANGUAGES.find((l) => l.value === current);
  const short = selected?.short ?? 'ES-ES';

  return (
    <Select value={current} onValueChange={(lang) => i18n.changeLanguage(lang)}>
      <SelectTrigger
        className={
          variant === 'header' ? 'w-auto gap-1 border-0 bg-transparent shadow-none' : 'w-full sm:w-72'
        }
        aria-label={t('common.language')}
      >
        <SelectValue>{variant === 'header' ? short : selected?.label}</SelectValue>
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
