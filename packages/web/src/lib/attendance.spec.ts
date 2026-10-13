import { describe, expect, it } from 'vitest';
import type { Activity, ActivityAttendance } from '@luma/shared';
import { activitiesOnDay, summarizeDayAttendance } from './attendance';

function activity(id: string, startDate: string, endDate: string): Activity {
  return { id, startDate, endDate } as Activity;
}

function attendance(overrides: Partial<ActivityAttendance> & { activityId: string }): ActivityAttendance {
  return {
    expected: [],
    presentCrewMemberIds: [],
    legacyPresentNames: [],
    legacyExpectedCount: 0,
    ...overrides,
  };
}

const crew = (id: string) => ({ crewMemberId: id }) as ActivityAttendance['expected'][number];

describe('activitiesOnDay', () => {
  it('incluye los bordes del rango', () => {
    const list = [
      activity('a', '2026-10-01', '2026-10-13'),
      activity('b', '2026-10-13', '2026-10-20'),
      activity('c', '2026-10-14', '2026-10-20'),
    ];
    expect(activitiesOnDay(list, '2026-10-13').map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('summarizeDayAttendance', () => {
  it('cuenta contra la cuadrilla asignada, no contra el número viejo', () => {
    const summary = summarizeDayAttendance(
      [activity('a', '2026-10-13', '2026-10-13')],
      [
        attendance({
          activityId: 'a',
          expected: [crew('1'), crew('2'), crew('3')],
          presentCrewMemberIds: ['1'],
          legacyExpectedCount: 0,
        }),
      ],
    );
    expect(summary).toEqual({ present: 1, expected: 3, missing: 2 });
  });

  it('un parte viejo cuenta con lo que se tipeó a mano', () => {
    const summary = summarizeDayAttendance(
      [activity('a', '2026-10-13', '2026-10-13')],
      [attendance({ activityId: 'a', legacyPresentNames: ['Juan'], legacyExpectedCount: 4 })],
    );
    expect(summary).toEqual({ present: 1, expected: 4, missing: 3 });
  });

  it('un reemplazo no da faltantes negativos', () => {
    const summary = summarizeDayAttendance(
      [activity('a', '2026-10-13', '2026-10-13')],
      [attendance({ activityId: 'a', expected: [crew('1')], presentCrewMemberIds: ['1', '9'] })],
    );
    expect(summary.missing).toBe(0);
  });

  it('ignora la asistencia de actividades que no son del día', () => {
    const summary = summarizeDayAttendance(
      [],
      [attendance({ activityId: 'a', expected: [crew('1')] })],
    );
    expect(summary).toEqual({ present: 0, expected: 0, missing: 0 });
  });
});
