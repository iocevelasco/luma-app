import { z } from 'zod';

/**
 * Registro diario de mano de obra por actividad (RF-03). Un registro por
 * (actividad, día) — no hay altas/bajas: recargar el mismo día actualiza el
 * existente, es un parte diario, no un historial.
 */

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

/**
 * El parte del día es sólo quiénes estuvieron: lo esperado vive en la
 * asignación de la actividad (`ActivityCrew`), no se repite por día.
 */
export const laborRecordSchema = z.object({
  activityId: z.string().trim().min(1, 'La actividad es obligatoria'),
  date: dayKeySchema,
  presentCrewMemberIds: z.array(z.string().trim().min(1)).max(200).default([]),
});

/** Asignar o quitar a alguien de la cuadrilla fija de una actividad. */
export const assignCrewToActivitySchema = z.object({
  crewMemberId: z.string().trim().min(1, 'Elegí a quién asignar'),
});

export type LaborRecordInput = z.infer<typeof laborRecordSchema>;
export type AssignCrewToActivityInput = z.infer<typeof assignCrewToActivitySchema>;
