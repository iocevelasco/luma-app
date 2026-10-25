import { useId, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActivityStatusIcon } from '@/components/common/activity-status-icon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchField } from '@/components/common/search-field';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACTIVITY_STATUSES } from '@/lib/activity-catalog';
import { countActiveFilters, type ActivityFilters } from '@/lib/activity-filters';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';

interface Person {
  key: string;
  name: string;
}

interface ActivityFilterControlsProps {
  filters: ActivityFilters;
  onChange: (patch: Partial<ActivityFilters>) => void;
  onReset: () => void;
  /** Quiénes son responsables de alguna actividad de la obra. */
  people: Person[];
  /** `material.read`: sin él no se sabe qué materiales faltan. */
  canFilterMaterials: boolean;
  /** `activity.review`: "esperando revisión" es del que cierra. */
  canFilterReview: boolean;
}

/** Cuántos responsables se ofrecen como avatar de un toque; el resto, en el panel. */
const AVATAR_LIMIT = 5;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function CheckRow({
  id,
  label,
  icon,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  /** Antes del texto: el ícono del estado. */
  icon?: ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal">
        {icon}
        {label}
      </Label>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Los controles de filtro de Actividades: búsqueda, responsables de un toque
 * (como los avatares de Jira) y el panel con el resto. Van en la barra de
 * arriba, a la derecha de las vistas, y valen para las tres.
 *
 * El botón lleva el conteo de filtros puestos: si algo quedó guardado de otra
 * vez, es lo primero que se ve (el detalle, en `ActiveFiltersNotice`).
 */
export function ActivityFilterControls({
  filters,
  onChange,
  onReset,
  people,
  canFilterMaterials,
  canFilterReview,
}: ActivityFilterControlsProps) {
  const { t } = useTranslation();
  const active = countActiveFilters(filters);
  // Un `id` por persona sale del índice, no de su clave: la clave es `name:juan perez`,
  // con dos puntos y espacios, y un `id` con espacios no es válido en HTML.
  const personIdBase = useId();

  return (
    <>
      <SearchField
        value={filters.text}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder={t('activity.filters.search')}
        aria-label={t('activity.filters.search')}
        // 40 px, el alto de toda la barra de Actividades (ver `TOOLBAR_H`).
        className="h-10 w-44 sm:w-56"
      />

      {people.length > 1 && (
        <div role="group" aria-label={t('activity.filters.people')} className="flex items-center -space-x-1.5">
          {people.slice(0, AVATAR_LIMIT).map((person) => {
            const selected = filters.responsibles.includes(person.key);
            return (
              <button
                key={person.key}
                type="button"
                title={person.name}
                aria-label={person.name}
                aria-pressed={selected}
                onClick={() => onChange({ responsibles: toggle(filters.responsibles, person.key) })}
                className={cn(
                  'rounded-full outline-none transition-transform hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring',
                  selected && 'z-10 ring-2 ring-primary',
                )}
              >
                <Avatar className="size-8 border-2 border-background">
                  <AvatarFallback className="text-2xs">{initials(person.name)}</AvatarFallback>
                </Avatar>
              </button>
            );
          })}
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-10" data-testid="activity-filters-button">
            <SlidersHorizontal className="size-4" />
            {t('activity.filters.button')}
            {active > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-2xs font-medium tabular-nums text-primary-foreground">
                {active}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex max-h-[70dvh] w-80 flex-col gap-5 overflow-y-auto">
          <Group title={t('activity.filters.quick')}>
            <CheckRow
              id="af-mine"
              label={t('activity.filters.mine')}
              checked={filters.mine}
              onChange={() => onChange({ mine: !filters.mine })}
            />
            <CheckRow
              id="af-overdue"
              label={t('activity.filters.overdue')}
              checked={filters.overdue}
              onChange={() => onChange({ overdue: !filters.overdue })}
            />
            {canFilterMaterials && (
              <CheckRow
                id="af-materials"
                label={t('activity.filters.missingMaterials')}
                checked={filters.missingMaterials}
                onChange={() => onChange({ missingMaterials: !filters.missingMaterials })}
              />
            )}
            {canFilterReview && (
              <CheckRow
                id="af-review"
                label={t('activity.filters.awaitingReview')}
                checked={filters.awaitingReview}
                onChange={() => onChange({ awaitingReview: !filters.awaitingReview })}
              />
            )}
          </Group>

          <Group title={t('activity.fields.status')}>
            {ACTIVITY_STATUSES.map((status) => (
              <CheckRow
                key={status}
                id={`af-status-${status}`}
                icon={<ActivityStatusIcon status={status} />}
                label={t(`activity.status.${status}`)}
                checked={filters.statuses.includes(status)}
                onChange={() => onChange({ statuses: toggle(filters.statuses, status) })}
              />
            ))}
          </Group>

          {people.length > 0 && (
            <Group title={t('activity.fields.responsible')}>
              {people.map((person, index) => (
                <CheckRow
                  key={person.key}
                  id={`${personIdBase}-person-${index}`}
                  label={person.name}
                  checked={filters.responsibles.includes(person.key)}
                  onChange={() => onChange({ responsibles: toggle(filters.responsibles, person.key) })}
                />
              ))}
            </Group>
          )}

          {active > 0 && (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onReset}>
              {t('activity.filters.clear')}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

interface FilterChip {
  id: string;
  label: string;
  clear: Partial<ActivityFilters>;
}

/** "Pintura, Gas +1": los dos primeros y cuántos más. */
function summarize(names: string[]): string {
  const [first, second, ...rest] = names;
  const head = [first, second].filter(Boolean).join(', ');
  return rest.length > 0 ? `${head} +${rest.length}` : head;
}

/**
 * El aviso de que hay filtros puestos, con cada uno como una etiqueta que se
 * quita sola y un "Limpiar todo".
 *
 * Los filtros se recuerdan entre visitas, así que pueden estar puestos sin que
 * la persona los haya tocado hoy: una pantalla recortada sin decirlo se lee
 * como una obra sin trabajo. Por eso el aviso está siempre a la vista y nunca
 * dentro del panel que se cierra. Es una píldora flotante y no una fila de la
 * barra de arriba: una fila nueva empujaba hacia abajo el contenido cada vez
 * que se ponía un filtro. Sin filtros no se dibuja.
 */
export function ActiveFiltersNotice({
  filters,
  onChange,
  onReset,
  people,
}: Pick<ActivityFilterControlsProps, 'filters' | 'onChange' | 'onReset' | 'people'>) {
  const { t } = useTranslation();
  const count = countActiveFilters(filters);
  if (count === 0) return null;

  const personName = (key: string) => people.find((person) => person.key === key)?.name ?? key;

  const chips: FilterChip[] = [];
  if (filters.text.trim()) {
    chips.push({ id: 'text', label: `«${filters.text.trim()}»`, clear: { text: '' } });
  }
  if (filters.statuses.length > 0) {
    chips.push({
      id: 'statuses',
      label: `${t('activity.fields.status')}: ${summarize(
        filters.statuses.map((status) => t(`activity.status.${status}`)),
      )}`,
      clear: { statuses: [] },
    });
  }
  if (filters.responsibles.length > 0) {
    chips.push({
      id: 'responsibles',
      label: `${t('activity.fields.responsible')}: ${summarize(filters.responsibles.map(personName))}`,
      clear: { responsibles: [] },
    });
  }
  if (filters.mine) chips.push({ id: 'mine', label: t('activity.filters.mine'), clear: { mine: false } });
  if (filters.overdue) {
    chips.push({ id: 'overdue', label: t('activity.filters.overdue'), clear: { overdue: false } });
  }
  if (filters.missingMaterials) {
    chips.push({
      id: 'missingMaterials',
      label: t('activity.filters.missingMaterials'),
      clear: { missingMaterials: false },
    });
  }
  if (filters.awaitingReview) {
    chips.push({
      id: 'awaitingReview',
      label: t('activity.filters.awaitingReview'),
      clear: { awaitingReview: false },
    });
  }

  return (
    <div
      role="status"
      data-testid="activity-filters-notice"
      // Flota abajo a la izquierda, frente a la acción principal (que va abajo a la
      // derecha): no ocupa lugar en la pantalla, así que ponerlo o quitarlo no
      // mueve la lista, el tablero ni el cronograma. `left` deja pasar la barra de
      // secciones (4rem) y `right`, el botón principal.
      className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-40 z-30 md:bottom-8 md:left-24 md:right-52"
    >
      <div className="pointer-events-auto flex w-fit max-w-full items-center gap-2 overflow-x-auto rounded-lg bg-card py-1.5 pl-4 pr-2 text-sm shadow-lg">
        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
          {t('activity.filters.notice', { count })}
        </span>
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-muted py-1 pl-3 pr-1 text-xs"
          >
            {chip.label}
            <button
              type="button"
              aria-label={t('activity.filters.remove', { filter: chip.label })}
              onClick={() => onChange(chip.clear)}
              className="grid size-5 place-items-center rounded-sm outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onReset}>
          {t('activity.filters.clearAll')}
        </Button>
      </div>
    </div>
  );
}
