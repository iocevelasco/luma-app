import type { Activity, ActivityStatus } from '@luma/shared';
import { isActivityOverdue } from './week';
import { purchaseFileName, sanitizeForPdf } from './materials-pdf';

/**
 * El PDF de las actividades del día, en tamaño carta: la hoja que se imprime
 * para llevar a la obra. Se arma en el navegador, igual que el de compras
 * (`materials-pdf.ts`): los datos ya están acá y `jspdf` se carga recién cuando
 * se aprieta el botón (o poco antes: ver la pantalla).
 */

/** `actividades-casa-rivera-2026-10-24.pdf`: sin espacios ni acentos, que viajan mal por chat. */
export function activitiesDayFileName(projectName: string, date: Date): string {
  return purchaseFileName(projectName, date, 'actividades');
}

export interface ActivitiesDayPdfLabels {
  /** "Actividades del día". */
  title: string;
  /** "5 actividades", ya con su plural. */
  summary: string;
  /** "Con filtros aplicados": sólo si la hoja no es la lista completa del día. */
  filtered: string | null;
  columns: { activity: string; specialty: string; responsible: string; dates: string; status: string };
  noSpecialty: string;
  overdue: string;
  /** "Generado el 24/10/2026 10:30". */
  generated: string;
  /** "Página 2 de 3". */
  page: (page: number, total: number) => string;
  specialty: (specialty: NonNullable<Activity['specialty']>) => string;
  status: (status: ActivityStatus) => string;
  /** Un día `YYYY-MM-DD` como se lee en el idioma de la persona. */
  day: (dayKey: string) => string;
}

export async function buildActivitiesDayPdf(input: {
  projectName: string;
  /** El día de la hoja, `YYYY-MM-DD`, para saber cuáles están atrasadas. */
  today: string;
  /** Su fecha como se lee en el idioma de la persona. */
  dateLabel: string;
  /** Ya recortadas al día (`activitiesOfDay`). */
  activities: Activity[];
  labels: ActivitiesDayPdfLabels;
}): Promise<Blob> {
  const { projectName, today, dateLabel, activities, labels } = input;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // Carta (8,5 × 11 in), vertical: lo que sale de la impresora en Estados
  // Unidos, México y buena parte de Latinoamérica.
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const margin = 15;

  // Todo el encabezado entra en el ancho útil de la hoja y, si no cabe en una línea,
  // pasa a la siguiente: `doc.text` solo no corta nada y un nombre de obra largo
  // se salía de la página. `y` es la línea de base de lo último escrito.
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = (fontSize: number) => (fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
  const write = (text: string, y: number, fontSize: number): number => {
    const lines: string[] = doc.splitTextToSize(sanitizeForPdf(text), usableWidth);
    doc.text(lines, margin, y);
    return y + (lines.length - 1) * lineHeight(fontSize);
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  let y = write(`${labels.title} - ${projectName}`, 20, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  y = write(`${dateLabel} - ${labels.summary}`, y + 7, 10);
  if (labels.filtered) y = write(labels.filtered, y + 5, 10);
  doc.setTextColor(0);

  // El casillero se dibuja, no se escribe: el carácter ☐ no existe en las
  // fuentes estándar. Va en el padding izquierdo de la celda de la actividad
  // para que quien recorre la obra tilde lo que ya hizo.
  const boxSize = 3.6;
  const boxGutter = 8;

  autoTable(doc, {
    startY: y + (labels.filtered ? 4 : 5),
    margin: { left: margin, right: margin, bottom: 18 },
    head: [
      [
        labels.columns.activity,
        labels.columns.specialty,
        labels.columns.responsible,
        labels.columns.dates,
        labels.columns.status,
      ],
    ],
    body: activities.map((activity) => {
      const overdue = isActivityOverdue(activity.endDate, activity.status, today);
      const dates =
        activity.startDate === activity.endDate
          ? labels.day(activity.startDate)
          : `${labels.day(activity.startDate)} - ${labels.day(activity.endDate)}`;
      return [
        sanitizeForPdf(activity.name),
        sanitizeForPdf(activity.specialty ? labels.specialty(activity.specialty) : labels.noSpecialty),
        sanitizeForPdf(activity.responsible.name),
        sanitizeForPdf(dates),
        sanitizeForPdf(
          overdue ? `${labels.status(activity.status)} (${labels.overdue})` : labels.status(activity.status),
        ),
      ];
    }),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, minCellHeight: 9, valign: 'middle' },
    headStyles: { fillColor: [16, 16, 16], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellPadding: { top: 2.2, bottom: 2.2, right: 2.2, left: boxGutter + 1 } },
      1: { cellWidth: 30 },
      2: { cellWidth: 34 },
      3: { cellWidth: 34 },
      4: { cellWidth: 30 },
    },
    // Lo atrasado, en rojo: es lo primero que hay que resolver.
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 4) return;
      const activity = activities[data.row.index];
      if (isActivityOverdue(activity.endDate, activity.status, today)) {
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      // Lo ya cerrado no se tilda: no queda nada por hacer.
      if (activities[data.row.index].status === 'completada') return;
      doc.setDrawColor(60);
      doc.setLineWidth(0.3);
      doc.rect(
        data.cell.x + 2.4,
        data.cell.y + (data.cell.height - boxSize) / 2,
        boxSize,
        boxSize,
      );
    },
    // Una actividad corta no se parte entre dos hojas.
    rowPageBreak: 'avoid',
  });

  // "Página 2 de 3" y cuándo se generó, al final, cuando ya se sabe cuántas son.
  const total = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  doc.setFontSize(9);
  doc.setTextColor(110);
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.text(sanitizeForPdf(labels.generated), margin, height - 10);
    doc.text(sanitizeForPdf(labels.page(page, total)), width - margin, height - 10, { align: 'right' });
  }

  return doc.output('blob');
}
