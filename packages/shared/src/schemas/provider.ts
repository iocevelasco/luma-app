import { z } from 'zod';

/**
 * Schemas del directorio de proveedores. Mismo criterio que `schemas/activity.ts`:
 * sin imports de `./index.ts`.
 */

/** Mismo criterio que `activity.ts`: fecha como `YYYY-MM-DD`, nunca `Date`. */
const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

/**
 * Fecha opcional que además tolera `''`. Un `<input type="date">` vacío manda
 * string vacío, no `undefined`: con un `.optional()` pelado el form queda
 * bloqueado por un campo que la persona dejó en blanco a propósito.
 */
const optionalDayKeySchema = z
  .union([dayKeySchema, z.literal('')])
  .optional()
  .transform((value) => value || undefined);

export const providerSpecialtySchema = z.enum([
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

export const providerScopeSchema = z.enum(['organization', 'project']);

/** Especialidades que admiten una descripción libre además del rubro. */
const SPECIALTIES_WITH_DETAIL = ['otra', 'acabados'] as const;

const providerBaseFields = {
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  companyName: z.string().trim().max(120, 'Es demasiado largo').optional(),
  specialty: providerSpecialtySchema,
  customSpecialty: z.string().trim().max(60, 'Es demasiado largo').optional(),
  scope: providerScopeSchema.default('organization'),
  phone: z
    .string()
    .trim()
    .min(1, 'El teléfono es obligatorio')
    .max(30, 'Es demasiado largo'),
  email: z.string().trim().toLowerCase().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().trim().max(1000, 'Es demasiado largo').optional(),
};

/**
 * `true` si ese rubro admite una descripción libre además del enum. En
 * `acabados` es opcional (el rubro ya dice bastante); en `otra` es lo único
 * que da información, así que el refine de abajo lo exige.
 */
export function allowsCustomSpecialty(specialty: string): boolean {
  return (SPECIALTIES_WITH_DETAIL as readonly string[]).includes(specialty);
}

/** `customSpecialty` es obligatorio si y sólo si `specialty` es `'otra'`. */
function refineCustomSpecialty<T extends { specialty: string; customSpecialty?: string }>(
  data: T,
) {
  return data.specialty !== 'otra' || Boolean(data.customSpecialty?.trim());
}

export const createProviderSchema = z
  .object(providerBaseFields)
  .refine(refineCustomSpecialty, {
    message: 'Describí la especialidad cuando elegís "Otra"',
    path: ['customSpecialty'],
  });

export const updateProviderSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    companyName: z.string().trim().max(120).optional(),
    specialty: providerSpecialtySchema.optional(),
    customSpecialty: z.string().trim().max(60).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    email: z.string().trim().toLowerCase().email('Email inválido').optional().or(z.literal('')),
    notes: z.string().trim().max(1000).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => !data.specialty || refineCustomSpecialty({ ...data, specialty: data.specialty }),
    { message: 'Describí la especialidad cuando elegís "Otra"', path: ['customSpecialty'] },
  );

export const assignProviderSchema = z.object({
  providerId: z.string().trim().min(1, 'Elegí un proveedor'),
});

/** Misma asignación N:N, vista desde el lado del proveedor. */
export const assignActivitySchema = z.object({
  activityId: z.string().trim().min(1, 'Elegí una actividad'),
});

// --- Contratación del proveedor ---

export const providerEngagementStatusSchema = z.enum([
  'solicitada',
  'cotizada',
  'aprobada',
  'rechazada',
]);

export const providerRequirementTypeSchema = z.enum([
  'materiales_en_obra',
  'personal_libre',
  'area_desocupada',
  'actividad_previa',
  'otro',
]);

const amountSchema = z
  .number({ invalid_type_error: 'Tiene que ser un número' })
  .nonnegative('No puede ser negativo')
  .max(999_999_999_999, 'Es demasiado grande');

export const providerRequirementSchema = z
  .object({
    type: providerRequirementTypeSchema,
    detail: z.string().trim().max(200, 'Es demasiado largo').optional(),
    activityId: z.string().trim().min(1).optional(),
    met: z.boolean().default(false),
  })
  .refine((data) => data.type !== 'otro' || Boolean(data.detail?.trim()), {
    message: 'Describí el requisito cuando elegís "Otro"',
    path: ['detail'],
  });

/** El adelanto nunca puede superar lo cotizado — ver el comentario del update. */
function advanceWithinQuote(data: { quotedAmount?: number; advanceAmount?: number }) {
  return (
    data.advanceAmount === undefined ||
    data.quotedAmount === undefined ||
    data.advanceAmount <= data.quotedAmount
  );
}

export const createProviderEngagementSchema = z
  .object({
    status: providerEngagementStatusSchema.default('solicitada'),
    quotedAmount: amountSchema.optional(),
    advanceAmount: amountSchema.optional(),
    estimatedStartDate: optionalDayKeySchema,
    requirements: z.array(providerRequirementSchema).max(20, 'Demasiados requisitos').default([]),
    notes: z.string().trim().max(1000, 'Es demasiado largo').optional(),
  })
  .refine(advanceWithinQuote, {
    message: 'El adelanto no puede superar lo cotizado',
    path: ['advanceAmount'],
  });

/**
 * El adelanto no puede superar lo cotizado: es la única regla del dominio que
 * atrapa un error de tipeo caro (un cero de más en el adelanto) antes de que
 * quede registrado como comprometido contra el presupuesto.
 */
export const updateProviderEngagementSchema = z
  .object({
    status: providerEngagementStatusSchema.optional(),
    quotedAmount: amountSchema.optional(),
    advanceAmount: amountSchema.optional(),
    estimatedStartDate: optionalDayKeySchema,
    requirements: z.array(providerRequirementSchema).max(20).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(advanceWithinQuote, {
    message: 'El adelanto no puede superar lo cotizado',
    path: ['advanceAmount'],
  });

export type CreateProviderEngagementInput = z.infer<typeof createProviderEngagementSchema>;
export type UpdateProviderEngagementInput = z.infer<typeof updateProviderEngagementSchema>;
export type ProviderRequirementInput = z.infer<typeof providerRequirementSchema>;

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type AssignProviderInput = z.infer<typeof assignProviderSchema>;
export type AssignActivityInput = z.infer<typeof assignActivitySchema>;
