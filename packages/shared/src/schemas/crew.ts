import { z } from 'zod';

/**
 * Schemas del personal fijo de obra y sus metas semanales. Mismo criterio que
 * el resto: sin imports de `./index.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const crewMemberKindSchema = z.enum(['persona', 'equipo']);

export const crewGoalStatusSchema = z.enum(['pendiente', 'cumplida', 'no_cumplida']);

/**
 * Duplica los valores de `providerSpecialtySchema` en vez de importarlo: los
 * schemas de dominio no se importan entre sí (ver cabecera de `project.ts`).
 * El test de abajo falla si las dos listas se desincronizan.
 */
export const crewSpecialtySchema = z.enum([
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'cristaleria',
  'albanileria',
  'herreria',
  'redes',
  'mecanicas',
  'estructura',
  'acabados',
  'pintura',
  'climatizacion',
  'techos',
  'pisos_revestimientos',
  'jardineria',
  'demolicion',
  'otra',
]);

export const createCrewMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  kind: crewMemberKindSchema.default('persona'),
  specialty: crewSpecialtySchema.optional(),
  isLead: z.boolean().default(false),
  scope: z.enum(['organization', 'project']).default('organization'),
  phone: z.string().trim().max(30, 'Es demasiado largo').optional(),
  notes: z.string().trim().max(1000, 'Es demasiado largo').optional(),
});

export const updateCrewMemberSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: crewMemberKindSchema.optional(),
  specialty: crewSpecialtySchema.optional(),
  isLead: z.boolean().optional(),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
});

export const createCrewGoalSchema = z.object({
  crewMemberId: z.string().trim().min(1, 'Elegí a quién le corresponde'),
  weekStart: dayKeySchema,
  description: z
    .string()
    .trim()
    .min(1, 'Escribí la meta')
    .max(500, 'Es demasiado larga'),
  activityId: z.string().trim().min(1).optional(),
  status: crewGoalStatusSchema.default('pendiente'),
});

export const updateCrewGoalSchema = z.object({
  description: z.string().trim().min(1).max(500).optional(),
  activityId: z.string().trim().min(1).optional(),
  status: crewGoalStatusSchema.optional(),
  weekStart: dayKeySchema.optional(),
});

export type CreateCrewMemberInput = z.infer<typeof createCrewMemberSchema>;
export type UpdateCrewMemberInput = z.infer<typeof updateCrewMemberSchema>;
export type CreateCrewGoalInput = z.infer<typeof createCrewGoalSchema>;
export type UpdateCrewGoalInput = z.infer<typeof updateCrewGoalSchema>;
