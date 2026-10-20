import { format } from 'date-fns';
import type { PurchaseRow } from './materials';

/**
 * El PDF de la lista de compras. Se arma en el navegador: los datos ya están
 * acá, y un endpoint sólo sumaría una dependencia pesada en la API para
 * devolver lo mismo.
 *
 * `jspdf` se importa dentro de la función, no arriba: pesa bastante y sólo lo
 * necesita quien aprieta el botón. Por eso la página precarga este módulo —y
 * con él la librería— apenas se muestra la pestaña: en Safari, compartir o
 * descargar tiene que pasar dentro del gesto de la persona, y esperar a bajar
 * un chunk grande lo deja afuera.
 *
 * Sin costos, a propósito: lo ve cualquiera con acceso a Compras y el PDF
 * sale de la app, a un chat o a una impresora.
 */

export interface PurchasePdfLabels {
  title: string;
  /** "20 materiales · 3 proveedores", ya traducido y con plural. */
  summary: string;
  columns: { material: string; quantity: string; supplier: string };
  noSupplier: string;
  requested: string;
  /** "Página 2 de 3". */
  page: (page: number, total: number) => string;
  unit: (unit: PurchaseRow['unit']) => string;
}

/**
 * Las fuentes estándar de un PDF cubren latin-1: sirven para ñ, á y ã, pero
 * un guion largo o un emoji salen como un cuadrado. Se reemplaza lo común y
 * se descarta el resto.
 */
export function sanitizeForPdf(text: string): string {
  return text
    .replace(/[–—]/g, '-') // guiones
    .replace(/[‘’]/g, "'") // comillas simples
    .replace(/[“”]/g, '"') // comillas dobles
    .replace(/…/g, '...') // puntos suspensivos
    // Todo lo que no es latin-1 imprimible (y los caracteres de control).
    .replace(/[^ -ÿ]/g, '')
    // Descartar un emoji entre dos espacios deja un hueco doble.
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** `compras-casa-rivera-2026-10-19.pdf`: sin espacios ni acentos, que viajan mal por chat. */
export function purchaseFileName(projectName: string, date: Date): string {
  const slug = projectName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `compras-${slug || 'obra'}-${format(date, 'yyyy-MM-dd')}.pdf`;
}

export async function buildPurchasePdf(input: {
  projectName: string;
  date: Date;
  /** Para el encabezado: `dd/MM/yyyy` o el formato que use el idioma. */
  dateLabel: string;
  rows: PurchaseRow[];
  labels: PurchasePdfLabels;
}): Promise<Blob> {
  const { projectName, dateLabel, rows, labels } = input;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(sanitizeForPdf(`${labels.title} - ${projectName}`), margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(sanitizeForPdf(`${dateLabel} - ${labels.summary}`), margin, 27);
  doc.setTextColor(0);

  // El casillero se dibuja, no se escribe: el carácter ☐ no existe en las
  // fuentes estándar. Va dentro del padding izquierdo de la celda del material
  // para que la tabla siga teniendo las tres columnas que se pidieron.
  const boxSize = 3.6;
  const boxGutter = 8;

  autoTable(doc, {
    startY: 32,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [[labels.columns.material, labels.columns.quantity, labels.columns.supplier]],
    body: rows.map((row) => [
      sanitizeForPdf(row.requested ? `${row.name} (${labels.requested})` : row.name),
      sanitizeForPdf(`${row.quantity} ${labels.unit(row.unit)}`),
      sanitizeForPdf(row.supplier ?? labels.noSupplier),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.2, minCellHeight: 8, valign: 'middle' },
    headStyles: { fillColor: [16, 16, 16], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellPadding: { top: 2.2, bottom: 2.2, right: 2.2, left: boxGutter + 1 } },
      1: { cellWidth: 38 },
      2: { cellWidth: 55 },
    },
    // Sin proveedor, en gris: se nota que falta decidirlo, no que está vacío.
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (data.column.index === 2 && !rows[data.row.index].supplier) {
        data.cell.styles.textColor = 120;
        data.cell.styles.fontStyle = 'italic';
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      // Lo ya pedido no se tilda: no hay nada que comprar.
      if (rows[data.row.index].requested) return;
      const x = data.cell.x + 2.4;
      const y = data.cell.y + (data.cell.height - boxSize) / 2;
      doc.setDrawColor(60);
      doc.setLineWidth(0.3);
      doc.rect(x, y, boxSize, boxSize);
    },
    // Un proveedor corto no se parte entre dos hojas.
    rowPageBreak: 'avoid',
  });

  // "Página 2 de 3" se escribe al final, cuando ya se sabe cuántas son.
  const total = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  doc.setFontSize(9);
  doc.setTextColor(110);
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.text(sanitizeForPdf(labels.page(page, total)), width - margin, height - 10, { align: 'right' });
  }

  return doc.output('blob');
}
