import type { ActivityStatus } from './activity.js';

/**
 * Directorio de proveedores/subcontratistas (electricidad, plomería,
 * carpintería, etc.). Vive a nivel `Organization` —la Empresa del
 * ejecutante— para reutilizarse entre todas sus obras, no se recarga por
 * proyecto. Sin impacto financiero: es contacto + trazabilidad de quién
 * trabajó en qué, no presupuesto (ver CLAUDE.md, "Exclusión explícita: pagos
 * y anticipos" — el mismo criterio aplica acá, un proveedor no tiene costo).
 */

export type ProviderSpecialty =
  | 'electricidad'
  | 'plomeria'
  | 'gas'
  | 'carpinteria'
  | 'albanileria'
  | 'pintura'
  | 'herreria'
  | 'techos'
  | 'climatizacion'
  | 'pisos_revestimientos'
  | 'vidrieria'
  | 'jardineria'
  | 'demolicion'
  | 'otra';

export interface Provider {
  id: string;
  organizationId: string;
  name: string;
  companyName?: string;
  specialty: ProviderSpecialty;
  /** Obligatorio cuando `specialty === 'otra'`; se ignora en cualquier otro caso. */
  customSpecialty?: string;
  phone: string;
  email?: string;
  notes?: string;
  /** Baja lógica: un proveedor desactivado sigue existiendo para no perder la
   *  trazabilidad de las actividades donde ya estuvo asignado. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderListResponse {
  providers: Provider[];
}

export interface ProviderResponse {
  provider: Provider;
}

/** Proveedores asignados a una actividad puntual (relación N:N vía `ActivityProvider`). */
export interface ActivityProvidersResponse {
  providers: Provider[];
}

/**
 * Actividad vista desde el lado del proveedor — versión liviana de `Activity`,
 * sin evidencia fotográfica (esa requiere firmar URLs y no hace falta acá).
 * Alcance: sólo actividades del proyecto donde se está consultando, aunque el
 * directorio sea de la Empresa — ver comentario en provider.controller.ts.
 */
export interface ProviderActivitySummary {
  id: string;
  name: string;
  area: string;
  startDate: string;
  endDate: string;
  status: ActivityStatus;
}

export interface ProviderActivitiesResponse {
  activities: ProviderActivitySummary[];
}
