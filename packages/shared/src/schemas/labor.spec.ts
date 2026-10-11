import { describe, expect, it } from 'vitest';
import { assignCrewToActivitySchema, laborRecordSchema } from './labor.js';

const validRecord = {
  activityId: 'activity-1',
  date: '2026-09-15',
};

describe('laborRecordSchema', () => {
  it('acepta un parte válido', () => {
    expect(laborRecordSchema.safeParse(validRecord).success).toBe(true);
  });

  /**
   * El parte del día sólo dice quiénes vinieron. Lo esperado vive en la
   * asignación de la actividad (`ActivityCrew`) y no se repite por día: si se
   * guardara acá, cada jornada habría que volver a declarar la misma cuadrilla.
   */
  it('sin presentes asume que no vino nadie', () => {
    const result = laborRecordSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.presentCrewMemberIds).toEqual([]);
  });

  it('acepta la lista de quienes estuvieron', () => {
    const result = laborRecordSchema.safeParse({
      ...validRecord,
      presentCrewMemberIds: ['crew-1', 'crew-2'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.presentCrewMemberIds).toHaveLength(2);
  });

  it('rechaza ids vacíos', () => {
    expect(
      laborRecordSchema.safeParse({ ...validRecord, presentCrewMemberIds: [''] }).success,
    ).toBe(false);
  });

  it('ya no acepta un conteo suelto: esperado son personas, no un número', () => {
    const result = laborRecordSchema.safeParse({ ...validRecord, expectedCount: 4 });
    expect(result.success).toBe(true);
    // Zod descarta la clave desconocida en vez de guardarla.
    if (result.success) expect('expectedCount' in result.data).toBe(false);
  });

  it('rechaza fecha con formato inválido', () => {
    expect(laborRecordSchema.safeParse({ ...validRecord, date: '15-09-2026' }).success).toBe(false);
  });

  it('rechaza sin activityId', () => {
    const { activityId: _activityId, ...rest } = validRecord;
    expect(laborRecordSchema.safeParse(rest).success).toBe(false);
  });
});

describe('assignCrewToActivitySchema', () => {
  it('acepta asignar a alguien del roster', () => {
    expect(assignCrewToActivitySchema.safeParse({ crewMemberId: 'crew-1' }).success).toBe(true);
  });

  it('rechaza una asignación sin persona', () => {
    expect(assignCrewToActivitySchema.safeParse({ crewMemberId: '' }).success).toBe(false);
  });
});
