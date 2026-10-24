import { z } from 'zod';

/**
 * Schemas del dominio de obras. Deliberadamente sin imports de `./index.ts`
 * (el de auth): evita depender del orden de evaluación de un barrel que se
 * re-exporta a sí mismo. Los ~4 caracteres de validación de email que se
 * duplican acá no justifican esa fragilidad.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const organizationRoleSchema = z.enum(['owner', 'member']);

/** Función de alguien del personal administrativo. No es un permiso: ver `CompanyStaffRole`. */
export const companyStaffRoleSchema = z.enum(['gerente', 'supervisor', 'contador']);

export const renameOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
});

/**
 * Datos de la Empresa que se editan juntos. Todo opcional: se manda sólo lo que
 * cambió. `''` en un contacto lo borra.
 */
/** Teléfono de contacto de una persona o de la Empresa. Opcional; '' lo borra. */
const contactPhoneSchema = z.string().trim().max(30, 'Es demasiado largo').optional();

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo')
    .optional(),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .or(z.literal(''))
    .optional(),
  contactPhone: contactPhoneSchema,
});

/**
 * De un integrante del equipo se corrige cómo se llama y qué función tiene: el
 * email es su identidad. La función es opcional porque quien se sumó antes de
 * que existiera no tiene una, y corregirle el nombre no debería obligar a
 * inventársela.
 */
export const updateOrganizationMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  staffRole: companyStaffRoleSchema.optional(),
  /** El teléfono que la Empresa tiene de esta persona; '' lo borra, ausente no lo toca. */
  phone: contactPhoneSchema,
});

/**
 * En qué obras está un proveedor o un empleado. Se manda la lista completa y
 * no altas y bajas sueltas: la pantalla muestra casillas, y "lo que veo es lo
 * que queda" evita pedidos que se pisan.
 */
export const setAssignedProjectsSchema = z.object({
  projectIds: z.array(z.string().trim().min(1)).max(500),
});

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(120, 'El nombre es demasiado largo'),
    description: z
      .string()
      .trim()
      .min(1, 'La descripción es obligatoria')
      .max(2000, 'La descripción es demasiado larga'),
    location: z
      .string()
      .trim()
      .min(1, 'La ubicación es obligatoria')
      .max(200, 'La ubicación es demasiado larga'),
    size: z.string().trim().max(80, 'Es demasiado largo').optional(),
    estimatedStartDate: dayKeySchema,
    estimatedEndDate: dayKeySchema,
    currency: z
      .string({ required_error: 'La moneda es obligatoria' })
      .trim()
      .min(1, 'La moneda es obligatoria')
      .max(10, 'Moneda inválida'),
  })
  .refine((data) => data.estimatedEndDate >= data.estimatedStartDate, {
    message: 'La fecha de entrega no puede ser anterior al inicio',
    path: ['estimatedEndDate'],
  });

/**
 * Ajustes de una obra ya creada. Parcial a propósito: hoy sólo se toca la
 * visibilidad de proveedores, y el resto de la ficha se edita al crearla.
 */
export const updateProjectSchema = z.object({
  providersVisibleToClient: z.boolean().optional(),
});

export const inviteClientSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'El email es obligatorio')
    .email('Email inválido'),
});

/**
 * Sumar a alguien al equipo de la Empresa. Email, nombre y función: el nombre
 * viaja porque una persona que todavía no tiene cuenta se crea con él (antes
 * quedaba como la parte local del email y nadie la reconocía en la lista).
 */
export const inviteMemberSchema = inviteClientSchema.extend({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  staffRole: companyStaffRoleSchema,
  phone: contactPhoneSchema,
});

/** Los roles que se invitan a una obra. El gerente no: se deriva de quién la creó. */
export const invitableProjectRoleSchema = z.enum(['supervisor', 'contador', 'cliente']);

/**
 * Invitar a alguien a una obra. A diferencia de `inviteClientSchema`, acá el
 * rol viaja explícito: desde que existe el supervisor, "invitar a la obra"
 * dejó de significar una sola cosa y el endpoint no puede adivinarlo.
 */
export const inviteProjectMemberSchema = inviteClientSchema.extend({
  role: invitableProjectRoleSchema,
});

export type RenameOrganizationInput = z.infer<typeof renameOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrganizationMemberInput = z.infer<typeof updateOrganizationMemberSchema>;
export type SetAssignedProjectsInput = z.infer<typeof setAssignedProjectsSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type InviteClientInput = z.infer<typeof inviteClientSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type InviteProjectMemberInput = z.infer<typeof inviteProjectMemberSchema>;

/**
 * Cuántos días una obra eliminada se queda en la papelera antes de borrarse
 * de verdad. Mientras tanto se puede restaurar con todo lo que tenía.
 */
export const PROJECT_TRASH_RETENTION_DAYS = 90;

/**
 * Eliminar una obra exige escribir su nombre. No es burocracia: es lo que
 * separa "toqué el botón sin querer" de "sé qué estoy mandando a la papelera".
 */
export const deleteProjectSchema = z.object({
  confirmName: z.string().trim().min(1, 'Escribí el nombre de la obra para confirmar'),
});

export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
