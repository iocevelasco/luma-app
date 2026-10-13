/**
 * Dominio de obras. Segundo dominio de negocio del producto (el primero fue
 * auth, en `./index.ts`) — por eso vive en su propio archivo en vez de sumarse
 * al de auth.
 */

import type {
  Capability,
  CompanyStaffRole,
  InvitableProjectRole,
  ProjectRole,
} from '../permissions/index.js';

export type ProjectStatus = 'active' | 'archived';

/**
 * `'member'` es el Asistente de Obra (RF-13, sección 2.3): acceso operativo
 * a todas las obras de la Empresa que lo invitó, sin ver presupuesto ni
 * poder invitar gente. `'owner'` es quien la Empresa crea sola al
 * registrarse — sigue siendo el único rol que se auto-asigna.
 */
export type OrganizationRole = 'owner' | 'member';

/** Empresa del ejecutante. Se auto-crea con cada usuario nuevo, nunca la crea a mano. */
export interface Organization {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  /** Quién la gestiona — no hace falta una fila de membresía aparte para el dueño. */
  createdBy: string;
  name: string;
  description: string;
  location: string;
  size?: string;
  /** `YYYY-MM-DD`, nunca ISO datetime — ver CLAUDE.md sobre fechas y Safari. */
  estimatedStartDate: string;
  estimatedEndDate: string;
  currency: string;
  status: ProjectStatus;
  /**
   * Si el cliente final ve el directorio de proveedores de esta obra y quién
   * está asignado a cada actividad. Por obra y no por proveedor: en algunas
   * obras el cliente conoce a todos los subcontratistas y en otras no tiene
   * por qué, pero rara vez es una decisión contacto por contacto.
   */
  providersVisibleToClient: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `GET /api/projects/:id`: la ficha más qué puede hacer acá quien la pide.
 *
 * `role` y `capabilities` vienen resueltos server-side contra la grilla de
 * `permissions/` — con los flags de la obra ya aplicados. La UI no vuelve a
 * derivar nada: pregunta por capacidad y muestra o esconde. Mandar la lista
 * y no el rol es lo que permite agregar un rol nuevo sin tocar el frontend.
 *
 * `isOwner`/`isEditor` quedan como azúcar derivada para no reescribir de una
 * sola vez todas las pantallas de la v1. Son lo mismo que preguntar por
 * `role === 'gerente'` y por `activity.evidence.write`; en código nuevo usá
 * `capabilities`.
 */
export interface ProjectDetail extends Project {
  role: ProjectRole;
  capabilities: Capability[];
  /** @deprecated Derivado de `role === 'gerente'`. Usá `capabilities`. */
  isOwner: boolean;
  /** @deprecated Derivado de `capabilities`. Usá `capabilities`. */
  isEditor: boolean;
}

/**
 * Acceso de una persona a una obra puntual, con el rol que tiene ahí.
 *
 * Reemplaza a `ProjectClient` de la v1: el cliente dejó de ser la única
 * relación invitable cuando entró el supervisor, y dos tablas con la misma
 * forma y distinto nombre terminan con dos flujos de invitación distintos.
 *
 * El gerente no tiene fila: se deriva de `Project.createdBy`. Una obra sin
 * dueño no existe, y tenerlo en dos lugares abre la puerta a que discrepen.
 */
export interface ProjectMembership {
  id: string;
  projectId: string;
  userId: string;
  role: InvitableProjectRole;
  invitedBy: string;
  createdAt: string;
}

/** Integrante de la obra, con los datos de contacto ya resueltos server-side. */
export interface ProjectMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: ProjectRole;
  createdAt: string;
}

/**
 * Una obra en el listado, con qué puede hacer acá quien lo pide. Sale resuelto
 * del server por la misma grilla que `ProjectDetail`: quien necesite saber en
 * qué obras puede invitar (la Empresa, para dar acceso) no tiene que abrir
 * cada una ni derivarlo del rol.
 */
export interface ProjectListItem extends Project {
  role: ProjectRole;
  capabilities: Capability[];
}

export interface ProjectListResponse {
  projects: ProjectListItem[];
}

export interface ProjectDetailResponse {
  project: ProjectDetail;
  /** Todo el equipo de la obra, gerente incluido — no sólo los clientes. */
  members: ProjectMemberSummary[];
}

export interface CreateProjectResponse {
  project: Project;
}

/**
 * Qué pasó con el mail de activación cuando una invitación creó la cuenta.
 *
 * El mail puede no salir (sin clave de Resend, remitente de prueba, dirección
 * mal escrita) y antes eso no lo sabía nadie: la API contestaba 201 y la
 * persona quedaba sin poder entrar. Si no salió, `activationUrl` trae el mismo
 * enlace que iba en el mail para que quien invita se lo haga llegar.
 *
 * Ausente cuando la invitación no creó cuenta (la persona ya existía).
 */
export interface ActivationDelivery {
  emailSent: boolean;
  /** Sólo viene cuando `emailSent` es false. */
  activationUrl?: string;
}

export interface InviteProjectMemberResponse extends Partial<ActivationDelivery> {
  member: ProjectMemberSummary;
}

export interface UpdateProjectMemberResponse {
  member: ProjectMemberSummary;
}

export interface RemoveProjectMemberResponse {
  membershipId: string;
}

export interface OrganizationResponse {
  organization: Organization;
}

/** Asistente de Obra de la Empresa, con los datos de contacto ya resueltos server-side. */
export interface OrganizationMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: OrganizationRole;
  /** Su función en la Empresa. Ausente en quien se sumó antes de que se pidiera. */
  staffRole?: CompanyStaffRole;
  /** Teléfono que la Empresa tiene de esta persona. Vive en el vínculo, no en su cuenta. */
  phone?: string;
  /** Todavía no activó la cuenta: se le puede reenviar la invitación. */
  pending: boolean;
  createdAt: string;
}

export interface OrganizationMembersResponse {
  members: OrganizationMemberSummary[];
}

export interface InviteMemberResponse extends Partial<ActivationDelivery> {
  member: OrganizationMemberSummary;
}
