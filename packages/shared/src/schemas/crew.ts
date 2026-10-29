import { z } from 'zod';

/**
 * Schemas del personal fijo de obra. Mismo criterio que
 * el resto: sin imports de `./index.ts`.
 */

export const crewMemberKindSchema = z.enum(['persona', 'equipo']);

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
  'fire_protection',
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
  phone: z.string().trim().max(30, 'Es demasiado largo').optional(),
  /**
   * Jornal diario. Opcional a propósito: una obra puede funcionar sin cargar
   * sueldos, y entonces la nómina no se calcula para esa persona en vez de
   * calcularla como cero —un cero haría creer que trabaja gratis.
   */
  dailyRate: z.coerce.number().min(0, 'El jornal no puede ser negativo').optional(),
  notes: z.string().trim().max(1000, 'Es demasiado largo').optional(),
  /**
   * "Es otra persona": el alta insiste aunque ya haya alguien con el mismo
   * nombre. No salta el chequeo de teléfono — mismo teléfono es la misma
   * persona.
   */
  allowDuplicateName: z.boolean().optional(),
});

export const updateCrewMemberSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: crewMemberKindSchema.optional(),
  specialty: crewSpecialtySchema.optional(),
  isLead: z.boolean().optional(),
  phone: z.string().trim().max(30).optional(),
  dailyRate: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
});

export type CreateCrewMemberInput = z.infer<typeof createCrewMemberSchema>;
export type UpdateCrewMemberInput = z.infer<typeof updateCrewMemberSchema>;
