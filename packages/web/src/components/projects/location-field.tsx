import { MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { usePublicConfig } from '@/hooks/public-config/use-public-config';
import {
  fetchPlaceSuggestions,
  mapsLanguage,
  MIN_QUERY_LENGTH,
  newPlacesSession,
  QUERY_DEBOUNCE_MS,
  type PlacesSession,
  type PlaceSuggestion,
} from '@/lib/google-places';
import { cn } from '@/lib/utils';

interface LocationFieldProps {
  id: string;
  value: string;
  placeId?: string;
  /** Cada cambio de texto llega sin `placeId`: el lugar elegido sólo sobrevive si el texto no cambia. */
  onChange: (location: string, placeId?: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * La dirección de la obra con sugerencias de Google (ADR-005 §2).
 *
 * El texto libre siempre vale: sin clave de Maps, sin red o si la persona no
 * elige nada, el campo es el `Input` de siempre. Elegir una sugerencia guarda
 * su `placeId`, que es lo que le da mapa a la obra.
 *
 * - Espera entre teclas y un mínimo de letras: cada pregunta a Google se cobra.
 * - Cambiar el texto después de elegir borra el `placeId`.
 * - `Enter` con la lista abierta elige y no envía el formulario (ni pasa de paso).
 * - La lista va debajo del campo, también en iOS, y lleva la atribución de Google.
 */
export function LocationField({
  id,
  value,
  placeId,
  onChange,
  onBlur,
  invalid,
  autoFocus,
}: LocationFieldProps) {
  const { t, i18n } = useTranslation();
  const { data: config } = usePublicConfig();
  const apiKey = config?.maps?.apiKey;
  const listId = useId();

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [typing, setTyping] = useState(false);
  const sessionRef = useRef<PlacesSession | null>(null);

  const language = mapsLanguage(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    const query = value.trim();
    // Sólo mientras la persona escribe: no al cargar un valor ni tras elegir.
    if (!apiKey || !typing || query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    // El SDK no se puede cancelar: una respuesta que llega después de otra
    // tecla se descarta.
    let stale = false;
    const timer = window.setTimeout(() => {
      sessionRef.current ??= newPlacesSession();
      fetchPlaceSuggestions(apiKey, query, sessionRef.current, language)
        .then((found) => {
          if (stale) return;
          setSuggestions(found);
          setActive(-1);
          setOpen(found.length > 0);
        })
        // Sin sugerencias se sigue escribiendo a mano: no hay nada que avisar.
        .catch(() => !stale && setSuggestions([]));
    }, QUERY_DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [apiKey, value, typing, language]);

  const choose = (suggestion: PlaceSuggestion) => {
    onChange(suggestion.text, suggestion.placeId);
    setTyping(false);
    setOpen(false);
    setSuggestions([]);
    // Elegir cierra la sesión de facturación: la próxima búsqueda abre otra.
    sessionRef.current = null;
  };

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-invalid={invalid}
        role={apiKey ? 'combobox' : undefined}
        aria-autocomplete={apiKey ? 'list' : undefined}
        aria-expanded={apiKey ? showList : undefined}
        aria-controls={apiKey ? listId : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setTyping(true);
          onChange(event.target.value, undefined);
        }}
        onBlur={() => {
          // Deja terminar el clic en una sugerencia antes de cerrar.
          window.setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => (index + 1) % suggestions.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const picked = suggestions[active >= 0 ? active : 0];
            if (picked) choose(picked);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      {placeId && !typing && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden="true" className="size-3" />
          {t('project.location.placeChosen')}
        </p>
      )}
      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md bg-card shadow-surface">
          <ul id={listId} role="listbox" aria-label={t('project.location.suggestions')}>
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.placeId}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  'flex cursor-pointer flex-col px-3 py-2 text-sm',
                  index === active && 'bg-secondary',
                )}
                // `mousedown` y no `click`: el `blur` del campo cierra la lista antes.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(suggestion);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span>{suggestion.main}</span>
                {suggestion.secondary && (
                  <span className="text-xs text-muted-foreground">{suggestion.secondary}</span>
                )}
              </li>
            ))}
          </ul>
          {/* Atribución que piden las políticas de Places al mostrar sugerencias sin mapa. */}
          <p className="px-3 py-1.5 text-right text-2xs text-muted-foreground" translate="no">
            Google Maps
          </p>
        </div>
      )}
    </div>
  );
}
