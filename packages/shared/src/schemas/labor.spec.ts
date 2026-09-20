import { describe, expect, it } from 'vitest';
import { laborRecordSchema } from './labor.js';

const validRecord = {
  activityId: 'activity-1',
  date: '2026-09-15',
  expectedCount: 4,
};

describe('laborRecordSchema', () => {
  it('acepta un registro válido', () => {
    expect(laborRecordSchema.safeParse(validRecord).success).toBe(true);
  });

  it('default de presentNames es []', () => {
    const result = laborRecordSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.presentNames).toEqual([]);
  });

  it('rechaza expectedCount negativo', () => {
    expect(laborRecordSchema.safeParse({ ...validRecord, expectedCount: -1 }).success).toBe(false);
  });

  it('rechaza expectedCount no entero', () => {
    expect(laborRecordSchema.safeParse({ ...validRecord, expectedCount: 2.5 }).success).toBe(false);
  });

  it('acepta expectedCount cero', () => {
    expect(laborRecordSchema.safeParse({ ...validRecord, expectedCount: 0 }).success).toBe(true);
  });

  it('rechaza fecha con formato inválido', () => {
    expect(laborRecordSchema.safeParse({ ...validRecord, date: '15-09-2026' }).success).toBe(false);
  });

  it('rechaza sin activityId', () => {
    const { activityId: _activityId, ...rest } = validRecord;
    expect(laborRecordSchema.safeParse(rest).success).toBe(false);
  });

  it('acepta presentNames con nombres', () => {
    const result = laborRecordSchema.safeParse({
      ...validRecord,
      presentNames: ['Juan Pérez', 'María Gómez'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.presentNames).toHaveLength(2);
  });

  it('rechaza nombres vacíos en presentNames', () => {
    expect(
      laborRecordSchema.safeParse({ ...validRecord, presentNames: [''] }).success,
    ).toBe(false);
  });
});
