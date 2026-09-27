import { z } from 'zod';

/**
 * Schemas del directorio de proveedores. Mismo criterio que `schemas/activity.ts`:
 * sin imports de `./index.ts`.
 */

export const providerSpecialtySchema = z.enum([
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'albanileria',
  'pintura',
  'herreria',
  'techos',
  'climatizacion',
  'pisos_revestimientos',
  'vidrieria',
  'jardineria',
  'demolicion',
  'otra',
]);

const providerBaseFields = {
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  companyName: z.string().trim().max(120, 'Es demasiado largo').optional(),
  specialty: providerSpecialtySchema,
  customSpecialty: z.string().trim().max(60, 'Es demasiado largo').optional(),
  phone: z
    .string()
    .trim()
    .min(1, 'El teléfono es obligatorio')
    .max(30, 'Es demasiado largo'),
  email: z.string().trim().toLowerCase().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().trim().max(1000, 'Es demasiado largo').optional(),
};

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

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type AssignProviderInput = z.infer<typeof assignProviderSchema>;
export type AssignActivityInput = z.infer<typeof assignActivitySchema>;
