import { jsPDF } from 'jspdf';
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

/** Una línea de texto del PDF: el contenido, su tamaño y dónde está (en puntos, desde abajo). */
interface TextRun {
  text: string;
  size: number;
  y: number;
}

/**
 * Lee del PDF sin comprimir cada texto que se dibujó. jsPDF escribe cada uno como
 * `/F2 16 Tf`, `18.4 TL`, `x y Td` y `(texto) Tj`; una línea que sigue en el mismo
 * bloque es `T* (texto) Tj`, que baja `TL` puntos.
 */
function textRuns(pdf: string): TextRun[] {
  const runs: TextRun[] = [];
  let size = 0;
  let leading = 0;
  let y = 0;
  for (const line of pdf.split('\n')) {
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^\/F\d+ ([\d.]+) Tf$/))) size = Number(match[1]);
    else if ((match = line.match(/^([\d.]+) TL$/))) leading = Number(match[1]);
    else if ((match = line.match(/^[\d.-]+ ([\d.-]+) Td$/))) y = Number(match[1]);
    else if ((match = line.match(/^(T\* )?\((.*)\) Tj$/))) {
      if (match[1]) y -= leading;
      runs.push({ text: match[2].replace(/\\([()\\])/g, '$1'), size, y });
    }
  }
  return runs;
}

async function buildPdfText(overrides: Partial<Parameters<typeof buildActivitiesDayPdf>[0]> = {}) {
  const blob = await buildActivitiesDayPdf({
    projectName: 'Casa Rivera',
    today: DAY,
    dateLabel: '24/10/2026',
    activities: [activity('a', '2026-10-20', '2026-10-30')],
    labels,
    ...overrides,
  });
  return new TextDecoder('latin1').decode(await blob.arrayBuffer());
}

describe('el encabezado del PDF', () => {
  // Carta: 215,9 mm de ancho con 15 mm de margen a cada lado.
  const USABLE_MM = 215.9 - 30;
  const LONG_NAME =
    'Edificio Residencial Torre Norte Etapa 3 Fundaciones y Estructura de Hormigon Armado Sector Sur Subsuelo con Cocheras y Salones';

  /** Lo que mide una línea de título en el PDF, con la misma fuente que se usa para dibujarla. */
  function titleWidthMm(text: string): number {
    const reference = new jsPDF({ unit: 'mm', format: 'letter' });
    reference.setFont('helvetica', 'bold');
    reference.setFontSize(16);
    return reference.getTextWidth(text);
  }

  it('un nombre de obra corto sigue en una sola línea, en el mismo lugar de siempre', async () => {
    const runs = textRuns(await buildPdfText());
    const title = runs.filter((run) => run.size === 16);
    expect(title.map((run) => run.text)).toEqual(['Actividades del día - Casa Rivera']);
    // 20 mm desde arriba en una hoja de 792 pt.
    expect(title[0].y).toBeCloseTo(792 - (20 * 72) / 25.4, 1);
  });

  it('un nombre de obra largo pasa a más líneas y cada una entra en el ancho útil de la hoja', async () => {
    const runs = textRuns(await buildPdfText({ projectName: LONG_NAME }));
    const title = runs.filter((run) => run.size === 16);

    expect(title.length).toBeGreaterThan(1);
    for (const line of title) expect(titleWidthMm(line.text)).toBeLessThanOrEqual(USABLE_MM);
    // No se pierde nada: las líneas, juntas, son el título entero.
    expect(title.map((run) => run.text).join(' ')).toBe(`Actividades del día - ${LONG_NAME}`);
  });

  it('lo que sigue al título baja con él: la fecha no se pisa con la última línea y la tabla no pisa la fecha', async () => {
    const runs = textRuns(await buildPdfText({ projectName: LONG_NAME, labels: { ...labels, filtered: 'Con filtros aplicados' } }));
    const title = runs.filter((run) => run.size === 16);
    const subtitle = runs.find((run) => run.text.startsWith('24/10/2026'))!;
    const filtered = runs.find((run) => run.text === 'Con filtros aplicados')!;
    const header = runs.find((run) => run.text === 'Actividad')!;

    const lastTitle = Math.min(...title.map((run) => run.y));
    // Un título de 16 pt y un texto de 10 pt debajo: por lo menos el cuerpo del título de distancia.
    expect(lastTitle - subtitle.y).toBeGreaterThanOrEqual(16);
    expect(subtitle.y - filtered.y).toBeGreaterThanOrEqual(10);
    expect(filtered.y - header.y).toBeGreaterThanOrEqual(10);
  });

  it('una palabra más larga que la hoja también se parte', async () => {
    const runs = textRuns(await buildPdfText({ projectName: 'X'.repeat(160) }));
    const title = runs.filter((run) => run.size === 16);
    expect(title.length).toBeGreaterThan(1);
    for (const line of title) expect(titleWidthMm(line.text)).toBeLessThanOrEqual(USABLE_MM);
  });
});
