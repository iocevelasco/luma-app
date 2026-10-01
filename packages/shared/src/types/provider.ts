import type { ActivityStatus } from './activity.js';

/**
 * Directorio de proveedores/subcontratistas (electricidad, plomería,
 * carpintería, etc.). Vive a nivel `Organization` —la Empresa del
 * ejecutante— para reutilizarse entre todas sus obras, no se recarga por
 * proyecto. Sin impacto financiero: es contacto + trazabilidad de quién
 * trabajó en qué, no presupuesto (ver CLAUDE.md, "Exclusión explícita: pagos
 * y anticipos" — el mismo criterio aplica acá, un proveedor no tiene costo).
 */

/**
 * Los once primeros son el catálogo que usa el cliente en obra; el resto son
 * rubros que ya estaban y se contratan aparte en obras chicas (en una casa se
 * contrata "climatización", en un edificio entra dentro de "mecánicas").
 *
 * `acabados` es deliberadamente amplio: según qué se esté haciendo cambia por
 * completo, así que admite `customSpecialty` igual que `otra`.
 */
export type ProviderSpecialty =
  | 'electricidad'
  | 'plomeria'
  | 'gas'
  | 'carpinteria'
  | 'cristaleria'
  | 'albanileria'
  | 'herreria'
  | 'redes'
  | 'mecanicas'
  | 'estructura'
  | 'acabados'
  | 'pintura'
  | 'climatizacion'
  | 'techos'
  | 'pisos_revestimientos'
  | 'jardineria'
  | 'demolicion'
  | 'otra';

/**
 * De dónde sale el proveedor.
 *
 * `organization` es la libreta del ejecutante: los que usa siempre, visibles
 * en todas sus obras. `project` es la excepción — el proveedor que trae el
 * cliente para un rubro puntual de UNA obra, que no tiene por qué ensuciar la
 * libreta del resto.
 */
export type ProviderScope = 'organization' | 'project';

export interface Provider {
  id: string;
  organizationId: string;
  scope: ProviderScope;
  /** Sólo cuando `scope === 'project'`: la obra a la que queda atado. */
  projectId?: string;
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

/**
 * Contratación de un proveedor para una obra: el acuerdo comercial, separado
 * de `ActivityProvider` (que dice quién trabaja en qué). Una cotización suele
 * cubrir varias actividades, así que fusionarlas obligaría a cotizar
 * actividad por actividad.
 *
 * No tiene estados de ejecución ("en curso", "terminado") a propósito: el
 * avance del trabajo ya vive en el estado de cada actividad, y repetirlo acá
 * serían dos fuentes de verdad que se contradicen.
 */
export type ProviderEngagementStatus = 'solicitada' | 'cotizada' | 'aprobada' | 'rechazada';

/**
 * Lo que tiene que estar listo para que el proveedor pueda arrancar. Los
 * cuatro primeros son los que se repiten en toda obra; `otro` cubre el resto.
 */
export type ProviderRequirementType =
  | 'materiales_en_obra'
  | 'personal_libre'
  | 'area_desocupada'
  | 'actividad_previa'
  | 'otro';

export interface ProviderRequirement {
  id: string;
  type: ProviderRequirementType;
  /** Obligatorio en `otro`; en el resto es una aclaración opcional. */
  detail?: string;
  /**
   * Sólo en `actividad_previa`. No cambia `met` solo: la UI muestra el estado
   * de esa actividad al lado, pero quien marca el requisito es una persona —
   * un check que se mueve solo es un check en el que nadie confía.
   */
  activityId?: string;
  met: boolean;
}

export interface ProviderEngagement {
  id: string;
  projectId: string;
  providerId: string;
  status: ProviderEngagementStatus;
  /**
   * Montos como COMPROMISO contra el presupuesto, no como contabilidad: la
   * plataforma no registra pagos ni cuentas por pagar (ver documento
   * funcional, "Exclusión explícita: pagos y anticipos").
   */
  quotedAmount?: number;
  advanceAmount?: number;
  /** `YYYY-MM-DD`, nunca ISO datetime — ver CLAUDE.md sobre fechas y Safari. */
  estimatedStartDate?: string;
  requirements: ProviderRequirement[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderEngagementListResponse {
  engagements: ProviderEngagement[];
}

export interface ProviderEngagementResponse {
  engagement: ProviderEngagement;
}
