/**
 * Dominio de obras. Segundo dominio de negocio del producto (el primero fue
 * auth, en `./index.ts`) — por eso vive en su propio archivo en vez de sumarse
 * al de auth.
 */

export type BudgetType = 'cerrado' | 'abierto' | 'con_margen';

export type ProjectStatus = 'active' | 'archived';

/** En v1 sólo se crea `'owner'` — no hay todavía forma de sumar gente a una Empresa. */
export type OrganizationRole = 'owner' | 'member';

/** Empresa del ejecutante. Se auto-crea con cada usuario nuevo, nunca la crea a mano. */
export interface Organization {
  id: string;
  name: string;
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
  budgetType: BudgetType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/projects/:id`: la ficha más si quien la pide es su dueño. */
export interface ProjectDetail extends Project {
  isOwner: boolean;
}

/** Fila de acceso de un cliente a una obra puntual — no un rol genérico. */
export interface ProjectClient {
  id: string;
  projectId: string;
  userId: string;
  invitedBy: string;
  createdAt: string;
}

/** Cliente de una obra, con los datos de contacto ya resueltos server-side. */
export interface ProjectClientSummary {
  id: string;
  userId: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface ProjectDetailResponse {
  project: ProjectDetail;
  clients: ProjectClientSummary[];
}

export interface CreateProjectResponse {
  project: Project;
}

export interface InviteClientResponse {
  client: ProjectClientSummary;
}

export interface OrganizationResponse {
  organization: Organization;
}
