import { useState } from 'react';
import type { Provider } from '@luma/shared';
import { Check, ChevronsUpDown, PenLine, Plus, X } from 'lucide-react';
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
import { fieldBase } from '@/lib/field-styles';
import { supplierKey } from '@/lib/materials';
import { cn } from '@/lib/utils';

/** Lo que elige la persona: un proveedor del directorio o un nombre escrito. Nunca los dos. */
export interface SupplierChoice {
  providerId: string | null;
  supplier: string;
}

interface ProviderComboboxProps {
  id: string;
  /** Los proveedores activos que ve la obra (`useProviders`). */
  providers: readonly Provider[];
  value: SupplierChoice;
  onChange: (next: SupplierChoice) => void;
  /**
   * Nombre del vinculado cuando ya no está en `providers` —se dio de baja—:
   * el material lo sigue mostrando aunque no se pueda volver a elegir.
   */
  linkedName?: string;
  /** `false` en la asignación en lote: ahí sólo se elige del directorio. */
  allowFreeText?: boolean;
  /**
   * Abre el alta de un proveedor con lo que se venía buscando. Sin esto (sin
   * `provider.create`) no se ofrece: queda escribirlo sin vincular.
   */
  onCreate?: (name: string) => void;
}

/**
 * El campo "Proveedor" de un material: busca en los proveedores de la obra y,
 * si el que se busca no está cargado, deja usar lo escrito sin vincular. Es lo
 * que pidió el cliente — cargar al proveedor una vez en Proveedores y después
 * elegirlo al pedir materiales — sin trabar a quien está en la obra con un
 * alta que quizás no puede hacer.
 *
 * Se ve como un `Select` del sistema (mismo radio, borde y alto), no como un
 * botón: es un campo del formulario.
 */
export function ProviderCombobox({
  id,
  providers,
  value,
  onChange,
  linkedName,
  allowFreeText = true,
  onCreate,
}: ProviderComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const linked = value.providerId
    ? (providers.find((provider) => provider.id === value.providerId)?.name ?? linkedName)
    : undefined;
  const label = linked ?? (value.supplier.trim() || undefined);
  const typed = search.trim();
  const typedMatches = providers.some((provider) => supplierKey(provider.name) === supplierKey(typed));

  function choose(next: SupplierChoice) {
    onChange(next);
    setSearch('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left text-sm',
            fieldBase,
          )}
        >
          <span className={cn('flex min-w-0 items-center gap-2', !label && 'text-muted-foreground')}>
            {/* Lo escrito a mano se distingue de lo vinculado: es la pista para vincularlo. */}
            {label && !linked && <PenLine aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{label ?? t('material.provider.placeholder')}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t('material.provider.search')}
          />
          <CommandList>
            <CommandEmpty>
              {allowFreeText && typed ? null : t('material.provider.noResults')}
            </CommandEmpty>
            {providers.length > 0 && (
              <CommandGroup heading={t('material.provider.fromDirectory')}>
                {providers.map((provider) => (
                  <CommandItem
                    key={provider.id}
                    // El id en el valor: dos proveedores pueden llamarse igual.
                    value={`${provider.name} ${provider.companyName ?? ''} ${provider.id}`}
                    onSelect={() => choose({ providerId: provider.id, supplier: '' })}
                  >
                    <Check
                      aria-hidden
                      className={cn('size-4', value.providerId === provider.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="truncate">{provider.name}</span>
                    {provider.companyName && (
                      <span className="truncate text-muted-foreground">{provider.companyName}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {allowFreeText && typed && !typedMatches && (
              <CommandGroup>
                <CommandItem
                  value={`__typed__ ${typed}`}
                  onSelect={() => choose({ providerId: null, supplier: typed })}
                >
                  <PenLine aria-hidden className="size-4" />
                  {t('material.provider.useTyped', { name: typed })}
                </CommandItem>
              </CommandGroup>
            )}
            {onCreate && (
              <CommandGroup>
                {/* El valor lleva lo buscado: así cmdk no lo esconde al filtrar. */}
                <CommandItem
                  value={`__create__ ${typed}`}
                  onSelect={() => {
                    setOpen(false);
                    setSearch('');
                    onCreate(typed);
                  }}
                >
                  <Plus aria-hidden className="size-4" />
                  {t('material.provider.create')}
                </CommandItem>
              </CommandGroup>
            )}
            {label && !typed && (
              <CommandGroup>
                <CommandItem value="__none__" onSelect={() => choose({ providerId: null, supplier: '' })}>
                  <X aria-hidden className="size-4" />
                  {t('material.provider.none')}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
