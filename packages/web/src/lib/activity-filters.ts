import type { Activity, ActivityStatus } from '@luma/shared';
import { ACTIVITY_STATUSES } from '@/lib/activity-catalog';
import { responsibleKey } from '@/lib/task-board';
import { isActivityOverdue } from '@/lib/week';

/**
 * Los filtros de la pantalla de Actividades. Son **una sola cosa para las tres
 * vistas** (Cronograma, Tablero y Lista): se elige una vez y lo que se mira
 * cambia con el mismo recorte en todas.
 *
 * Lógica pura y aparte del componente, para probar sin montar React. Dentro de
 * un mismo filtro las opciones suman (estado A *o* B); entre filtros restan
 * (estado A *y* atrasadas).
 */
export interface ActivityFilters {
  /** Texto libre sobre el nombre de la actividad y el responsable. */
  text: string;
  statuses: ActivityStatus[];
  /** Claves de `responsibleKey`, no nombres. */
  responsibles: string[];
  /** Sólo las que tienen a la persona que mira como responsable. */
  mine: boolean;
  overdue: boolean;
  missingMaterials: boolean;
  /** Reportadas como terminadas y a la espera de que alguien las cierre. */
  awaitingReview: boolean;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = {
  text: '',
  statuses: [],
  responsibles: [],
  mine: false,
  overdue: false,
  missingMaterials: false,
  awaitingReview: false,
};

/** Lo que hace falta de afuera para evaluar los filtros derivados. */
export interface ActivityFilterContext {
  /** `YYYY-MM-DD`. */
  today: string;
  /** Quien mira; sin él, "mías" no coincide con nada. */
  userId?: string;
  /** Actividades con materiales que no llegaron (ver `MATERIAL_STATUSES_BLOCKING`). */
  missingMaterialIds: ReadonlySet<string>;
}

/** Minúsculas y sin acentos: "Plomería" se encuentra escribiendo "plomeria". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Cuántos filtros hay puestos. Cuenta por filtro y no por opción: tres rubros
 * tildados son un filtro, "rubro", y así se lee en el aviso.
 */
export function countActiveFilters(filters: ActivityFilters): number {
  return [
    filters.text.trim() !== '',
    filters.statuses.length > 0,
    filters.responsibles.length > 0,
    filters.mine,
    filters.overdue,
    filters.missingMaterials,
    filters.awaitingReview,
  ].filter(Boolean).length;
}

export function applyActivityFilters(
  activities: Activity[],
  filters: ActivityFilters,
  context: ActivityFilterContext,
): Activity[] {
  if (countActiveFilters(filters) === 0) return activities;

  const text = fold(filters.text);

  return activities.filter((activity) => {
    if (text && !fold(`${activity.name} ${activity.responsible.name}`).includes(text)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(activity.status)) return false;
    if (filters.responsibles.length > 0 && !filters.responsibles.includes(responsibleKey(activity))) {
      return false;
    }
    if (filters.mine && !(context.userId && activity.responsible.user === context.userId)) {
      return false;
    }
    if (filters.overdue && !isActivityOverdue(activity.endDate, activity.status, context.today)) {
      return false;
    }
    if (filters.missingMaterials && !context.missingMaterialIds.has(activity.id)) return false;
    if (filters.awaitingReview && activity.status !== 'en_revision') return false;
    return true;
  });
}

/**
 * Lo guardado puede estar viejo: un estado que se renombró, un filtro que ya no
 * existe, un JSON a medio escribir. Devuelve siempre filtros válidos, y lo
 * que no se reconoce se descarta en lugar de romper la pantalla.
 */
export function sanitizeActivityFilters(raw: unknown): ActivityFilters {
  if (typeof raw !== 'object' || raw === null) return EMPTY_ACTIVITY_FILTERS;
  const value = raw as Record<string, unknown>;

  const list = <T extends string>(input: unknown, allowed?: readonly T[]): T[] =>
    Array.isArray(input)
      ? input.filter(
          (item): item is T =>
            typeof item === 'string' && (allowed ? (allowed as readonly string[]).includes(item) : true),
        )
      : [];

  return {
    text: typeof value.text === 'string' ? value.text : '',
    statuses: list(value.statuses, ACTIVITY_STATUSES),
    responsibles: list<string>(value.responsibles),
    mine: value.mine === true,
    overdue: value.overdue === true,
    missingMaterials: value.missingMaterials === true,
    awaitingReview: value.awaitingReview === true,
  };
}

/**
 * Suelta los responsables que ya no figuran en la obra (se dio de baja a la
 * persona, o se reasignó todo lo suyo). Sin esto quedaría un filtro invisible
 * que deja la pantalla en blanco: no hay chip que apretar para quitarlo.
 *
 * Aparte de `sanitizeActivityFilters` porque necesita los datos de la obra, que
 * llegan después de leer lo guardado.
 */
export function pruneActivityFilters(
  filters: ActivityFilters,
  knownResponsibles: ReadonlySet<string>,
): ActivityFilters {
  const responsibles = filters.responsibles.filter((key) => knownResponsibles.has(key));
  return responsibles.length === filters.responsibles.length ? filters : { ...filters, responsibles };
}
