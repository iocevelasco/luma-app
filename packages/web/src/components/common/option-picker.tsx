import { useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage } from '@/lib/error-message';
import { fieldBase } from '@/lib/field-styles';
import { cn } from '@/lib/utils';

/** Pasado este número de opciones, elegir de una lista plana es scrollear a ciegas. */
export const OPTION_PICKER_SEARCH_THRESHOLD = 15;

export interface PickerOption {
  value: string;
  /** Texto ya resuelto: el picker no traduce, así sirve para cualquier catálogo. */
  label: string;
}

/** Minúsculas y sin acentos: «Diseño» se encuentra escribiendo «diseno». */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Selector de una opción entre varias. Hasta {@link OPTION_PICKER_SEARCH_THRESHOLD}
 * es el `Select` de siempre; con más, un buscador que filtra mientras se
 * escribe. `suggested` va primero y sólo mientras no se escribe nada.
 */
export function OptionPicker({
  id,
  value,
  onChange,
  options,
  suggested = [],
  onCreate,
  placeholder,
  invalid = false,
}: {
  id?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly PickerOption[];
  /** Valores a mostrar arriba, en este orden. Los que no estén en `options` se ignoran. */
  suggested?: readonly string[];
  /**
   * Con esto, escribir algo que no está en la lista ofrece «Crear …». Devuelve
   * el valor de la opción nueva, que queda elegida. Si lanza, el mensaje se
   * muestra junto al buscador y el popup sigue abierto.
   */
  onCreate?: (label: string) => Promise<string>;
  placeholder: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (options.length <= OPTION_PICKER_SEARCH_THRESHOLD) {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={invalid}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const selected = options.find((option) => option.value === value);
  const suggestedOptions = suggested
    .map((key) => options.find((option) => option.value === key))
    .filter((option): option is PickerOption => option !== undefined);
  const showSuggested = search === '' && suggestedOptions.length > 0;
  const rest = showSuggested
    ? options.filter((option) => !suggestedOptions.includes(option))
    : options;

  const typed = search.trim();
  const canCreate =
    onCreate !== undefined &&
    typed.length > 0 &&
    !options.some((option) => fold(option.label) === fold(typed));

  async function create() {
    if (!onCreate) return;
    setCreating(true);
    setCreateError(null);
    try {
      pick(await onCreate(typed));
    } catch (error) {
      setCreateError(errorMessage(error, t));
    } finally {
      setCreating(false);
    }
  }

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const renderItem = (option: PickerOption) => (
    <CommandItem
      key={option.value}
      // El `value` de cmdk es lo que se filtra: el rótulo, no la clave interna.
      value={option.label}
      onSelect={() => pick(option.value)}
    >
      <Check className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
      {option.label}
    </CommandItem>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch('');
          setCreateError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={invalid}
          data-placeholder={selected ? undefined : ''}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-sm whitespace-nowrap data-[placeholder]:text-muted-foreground',
            fieldBase,
            !selected && 'border-input',
          )}
        >
          <span className="line-clamp-1 text-left">{selected ? selected.label : placeholder}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      {/* `presentation` y no el `dialog` de Radix: el popup de un combobox es la lista,
          y durante su animación de salida un segundo `dialog` junto al drawer
          rompe a quien busca "el" diálogo de la pantalla. */}
      <PopoverContent
        align="start"
        role="presentation"
        className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command
          filter={(itemValue, query) => (fold(itemValue).includes(fold(query)) ? 1 : 0)}
        >
          <CommandInput
            value={search}
            onValueChange={(next) => {
              setSearch(next);
              setCreateError(null);
            }}
            placeholder={t('optionPicker.searchPlaceholder')}
          />
          <CommandList>
            <CommandEmpty>{canCreate ? null : t('optionPicker.empty')}</CommandEmpty>
            {showSuggested && (
              <CommandGroup heading={t('optionPicker.suggested')}>
                {suggestedOptions.map(renderItem)}
              </CommandGroup>
            )}
            <CommandGroup heading={showSuggested ? t('optionPicker.all') : undefined}>
              {rest.map(renderItem)}
            </CommandGroup>
            {canCreate && (
              <CommandGroup forceMount>
                {/* `forceMount`: cmdk esconde lo que no coincide con la búsqueda, y
                    esta fila existe justamente porque nada coincide. */}
                <CommandItem
                  forceMount
                  value={`__create__${typed}`}
                  disabled={creating}
                  onSelect={() => void create()}
                >
                  <Plus className="size-4" />
                  {t('optionPicker.create', { name: typed })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          {createError && (
            <p role="alert" className="border-t px-3 py-2 text-sm text-destructive">
              {createError}
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
