import { sanitizeForPdf } from './materials-pdf';

/**
 * El PDF de un listado de movimientos de plata (gastos o cobros): título, una
 * tabla y el total. Se arma en el navegador, igual que el de compras; `jspdf` se
 * carga recién cuando se aprieta el botón (o poco antes: ver las pantallas).
 *
 * Es el mismo armado para los dos listados: cada uno prepara sus filas ya como
 * texto (`expenses-pdf.ts`, `payments-pdf.ts`) y acá sólo se dibujan. La última
 * columna es siempre el importe, en la moneda de la obra.
 */
export interface MovementsPdfInput {
  projectName: string;
  title: string;
  /** "12 gastos · sábado, 24 de octubre de 2026", ya traducido. */
  summary: string;
  /** "Con filtros aplicados": sólo si la hoja no es la lista completa. */
  filtered: string | null;
  columns: string[];
  rows: string[][];
  /**
   * Ancho de cada columna: en mm, `'wrap'` (justo lo que ocupa su contenido, sin partirlo en dos
   * líneas: lo que corresponde a una fecha o a un importe) o `undefined` para que la tabla
   * reparta el resto.
   */
  widths: (number | 'wrap' | undefined)[];
  total: { label: string; value: string };
  /** "Generado el 24/10/2026 10:30". */
  generated: string;
  /** "Página 2 de 3". */
  page: (page: number, total: number) => string;
}

export async function buildMovementsPdf(input: MovementsPdfInput): Promise<Blob> {
  const { projectName, title, summary, filtered, columns, rows, widths, total } = input;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 15;
  const last = columns.length - 1;

  // Un nombre de obra largo pasa a la línea siguiente en vez de salirse de la hoja.
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = (fontSize: number) => (fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
  const write = (text: string, y: number, fontSize: number): number => {
    const lines: string[] = doc.splitTextToSize(sanitizeForPdf(text), usableWidth);
    doc.text(lines, margin, y);
    return y + (lines.length - 1) * lineHeight(fontSize);
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  let y = write(`${title} - ${projectName}`, 20, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  y = write(summary, y + 7, 10);
  if (filtered) y = write(filtered, y + 5, 10);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [columns],
    body: rows.map((row) => row.map(sanitizeForPdf)),
    foot: [[{ content: sanitizeForPdf(total.label), colSpan: last }, sanitizeForPdf(total.value)]],
    showFoot: 'lastPage',
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, minCellHeight: 9, valign: 'middle' },
    headStyles: { fillColor: [16, 16, 16], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(
      widths.map((width, index) => [
        index,
        { ...(width ? { cellWidth: width } : {}), ...(index === last ? { halign: 'right' as const } : {}) },
      ]),
    ),
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === last) data.cell.styles.halign = 'right';
    },
    // Un movimiento corto no se parte entre dos hojas.
    rowPageBreak: 'avoid',
  });

  // "Página 2 de 3" y cuándo se generó, al final, cuando ya se sabe cuántas son.
  const pages = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  doc.setFontSize(9);
  doc.setTextColor(110);
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.text(sanitizeForPdf(input.generated), margin, height - 10);
    doc.text(sanitizeForPdf(input.page(page, pages)), width - margin, height - 10, { align: 'right' });
  }

  return doc.output('blob');
}
