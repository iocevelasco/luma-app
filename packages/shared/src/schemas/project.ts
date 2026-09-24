import { z } from 'zod';

/**
 * Schemas del dominio de obras. Deliberadamente sin imports de `./index.ts`
 * (el de auth): evita depender del orden de evaluación de un barrel que se
 * re-exporta a sí mismo. Los ~4 caracteres de validación de email que se
 * duplican acá no justifican esa fragilidad.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const budgetTypeSchema = z.enum(['cerrado', 'abierto', 'con_margen']);

export const organizationRoleSchema = z.enum(['owner', 'member']);

export const renameOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
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
    currency: z.string().trim().min(1, 'La moneda es obligatoria').max(10, 'Moneda inválida'),
    budgetType: budgetTypeSchema,
  })
  .refine((data) => data.estimatedEndDate >= data.estimatedStartDate, {
    message: 'La fecha de entrega no puede ser anterior al inicio',
    path: ['estimatedEndDate'],
  });

export const inviteClientSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'El email es obligatorio')
    .email('Email inválido'),
});

/** Mismo shape que invitar cliente — invitar Asistente de Obra es "un email más". */
export const inviteMemberSchema = inviteClientSchema;

export type RenameOrganizationInput = z.infer<typeof renameOrganizationSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type InviteClientInput = z.infer<typeof inviteClientSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
