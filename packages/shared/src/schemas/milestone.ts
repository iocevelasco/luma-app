import { z } from 'zod';
import {
  MILESTONE_ATTENDEE_NAME_MAX,
  MILESTONE_ATTENDEES_MAX,
  MILESTONE_DESCRIPTION_MAX,
} from '../types/milestone.js';

/**
 * Schemas de hitos. Sin imports de `./index.ts`, mismo criterio que
 * `./project.ts`.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const milestoneTypeSchema = z.enum(
  [
    'etapa_concluida',
    'compra_significativa',
    'permisologia',
    'vicio_oculto',
    'retraso',
    'cambio_proyecto',
    'decision_made',
    'process_started',
    'reunion',
    'otro',
  ],
  { required_error: 'Elegí un tipo' },
);

export const milestoneAudienceSchema = z.enum(['cliente', 'interno'], {
  required_error: 'Elegí quién se entera',
});

export const milestoneSeveritySchema = z.enum(['info', 'atencion', 'critico']);

const descriptionSchema = z
  .string()
  .trim()
  .max(MILESTONE_DESCRIPTION_MAX, 'La descripción es demasiado larga');

export const milestoneAttendeesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'El nombre no puede estar vacío')
      .max(MILESTONE_ATTENDEE_NAME_MAX, 'El nombre es demasiado largo'),
  )
  .max(MILESTONE_ATTENDEES_MAX, `Una reunión admite hasta ${MILESTONE_ATTENDEES_MAX} asistentes`);

/**
 * Los asistentes son el único campo que depende del tipo. Se rechazan en
 * cualquier otro: guardarlos en silencio dejaría datos que ninguna pantalla
 * muestra.
 */
const ATTENDEES_ONLY_IN_MEETINGS = 'Sólo una reunión lleva asistentes';

function attendeesFitType(data: { type?: string; attendees?: string[] }): boolean {
  if (data.type === undefined || data.type === 'reunion') return true;
  return !data.attendees || data.attendees.length === 0;
}

export const createMilestoneSchema = z
  .object({
    type: milestoneTypeSchema,
    /**
     * Sin default: que el cliente se entere de algo es una decisión explícita,
     * y un default silencioso de `'cliente'` haría que una eventualidad interna
     * se publique por olvidarse de un campo.
     */
    audience: milestoneAudienceSchema,
    severity: milestoneSeveritySchema.default('info'),
    title: z
      .string()
      .trim()
      .min(1, 'El título es obligatorio')
      .max(160, 'El título es demasiado largo'),
    description: descriptionSchema.optional(),
    attendees: milestoneAttendeesSchema.optional(),
    occurredOn: dayKeySchema,
    activityId: z.string().trim().optional(),
  })
  .refine(attendeesFitType, { message: ATTENDEES_ONLY_IN_MEETINGS, path: ['attendees'] });

export const updateMilestoneSchema = z
  .object({
    type: milestoneTypeSchema.optional(),
    audience: milestoneAudienceSchema.optional(),
    severity: milestoneSeveritySchema.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: descriptionSchema.optional(),
    attendees: milestoneAttendeesSchema.optional(),
    occurredOn: dayKeySchema.optional(),
    activityId: z.string().trim().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay nada para actualizar',
  })
  // Sin `type` en el body, el tipo es el que ya tiene el hito guardado: ese
  // caso lo resuelve el controller, que es el único que lo conoce.
  .refine(attendeesFitType, { message: ATTENDEES_ONLY_IN_MEETINGS, path: ['attendees'] });

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
