import { describe, expect, it } from 'vitest';
import type { Activity, ActivityStatus } from '@luma/shared';
import { activitiesOfDay } from './activities-day';

const DAY = '2026-10-24';

function activity(id: string, startDate: string, endDate: string, status: ActivityStatus = 'pendiente'): Activity {
  return {
    id,
    projectId: 'p1',
    name: `actividad ${id}`,
    startDate,
    endDate,
    responsible: { name: 'Juan Pérez' },
    status,
    specialty: 'pintura',
    evidence: [],
    createdBy: 'u1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const ids = (list: Activity[]) => list.map((item) => item.id);

describe('activitiesOfDay', () => {
  it('trae las que tienen el día dentro de sus fechas, bordes incluidos', () => {
    const result = activitiesOfDay(
      [
        activity('antes', '2026-10-01', '2026-10-23'),
        activity('termina-hoy', '2026-10-20', DAY),
        activity('empieza-hoy', DAY, '2026-10-30'),
        activity('en-medio', '2026-10-10', '2026-10-30'),
        activity('despues', '2026-10-25', '2026-10-30'),
      ],
      DAY,
    );
    expect(ids(result).sort()).toEqual(['empieza-hoy', 'en-medio', 'termina-hoy']);
  });

  it('no incluye las canceladas', () => {
    expect(activitiesOfDay([activity('c', '2026-10-20', '2026-10-30', 'cancelada')], DAY)).toEqual([]);
  });

  it('las ordena por estado y, dentro de cada uno, por fecha de fin', () => {
    const result = activitiesOfDay(
      [
        activity('hecha', '2026-10-20', '2026-10-30', 'completada'),
        activity('pendiente-tarde', '2026-10-20', '2026-10-31', 'pendiente'),
        activity('pendiente-pronto', '2026-10-20', '2026-10-26', 'pendiente'),
        activity('curso', '2026-10-20', '2026-10-30', 'en_curso'),
        activity('revision', '2026-10-20', '2026-10-30', 'en_revision'),
      ],
      DAY,
    );
    expect(ids(result)).toEqual(['revision', 'curso', 'pendiente-pronto', 'pendiente-tarde', 'hecha']);
  });
});
