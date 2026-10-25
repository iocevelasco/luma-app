import { describe, expect, it } from 'vitest';
import type { Activity, ActivityStatus } from '@luma/shared';
import {
  activitiesDayFileName,
  activitiesOfDay,
  buildActivitiesDayPdf,
  type ActivitiesDayPdfLabels,
} from './activities-day-pdf';

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

describe('activitiesDayFileName', () => {
  it('lleva la obra y la fecha, sin espacios ni acentos', () => {
    expect(activitiesDayFileName('Casa Rivera — Etapa 2', new Date(2026, 9, 24))).toBe(
      'actividades-casa-rivera-etapa-2-2026-10-24.pdf',
    );
  });
});

const labels: ActivitiesDayPdfLabels = {
  title: 'Actividades del día',
  summary: '2 actividades',
  filtered: null,
  columns: { activity: 'Actividad', specialty: 'Especialidad', responsible: 'Responsable', dates: 'Fechas', status: 'Estado' },
  noSpecialty: 'Sin especialidad',
  overdue: 'Atrasada',
  generated: 'Generado el 24/10/2026',
  page: (page, total) => `Página ${page} de ${total}`,
  specialty: () => 'Pintura',
  status: (status) => status,
  day: (key) => key,
};

describe('buildActivitiesDayPdf', () => {
  it('arma un PDF en tamaño carta (612 × 792 pt)', async () => {
    const blob = await buildActivitiesDayPdf({
      projectName: 'Casa Rivera',
      today: DAY,
      dateLabel: '24/10/2026',
      activities: [activity('a', '2026-10-20', '2026-10-30'), activity('b', '2026-10-01', '2026-10-23', 'en_curso')],
      labels,
    });
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    expect(blob.type).toBe('application/pdf');
    expect(text.startsWith('%PDF')).toBe(true);
    // jsPDF escribe las medidas con el punto decimal (`612.`, `792.`).
    expect(text).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+612\.?0*\s+792\.?0*\s*\]/);
  });
});
