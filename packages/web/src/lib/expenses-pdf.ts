import type { Expense } from '@luma/shared';
import { purchaseFileName, sanitizeForPdf } from './materials-pdf';

/**
 * El PDF del listado de gastos. Se arma en el navegador, igual que el de
 * compras (`materials-pdf.ts`): los datos ya están acá y `jspdf` se carga recién
 * cuando se aprieta el botón (o poco antes: ver la pantalla).
 *
 * Los importes salen en la moneda de la obra —la que ya congeló cada gasto con
 * su cotización— y el total es la suma de ésos: nada se reconvierte acá.
 */

/** `gastos-casa-rivera-2026-10-24.pdf`: sin espacios ni acentos, que viajan mal por chat. */
export function expensesFileName(projectName: string, date: Date): string {
  return purchaseFileName(projectName, date, 'gastos');
}

export interface ExpensesPdfLabels {
  /** "Gastos". */
  title: string;
  /** "12 gastos", ya con su plural. */
  summary: string;
  /** "Con filtros aplicados": sólo si la hoja no es la lista completa. */
  filtered: string | null;
  columns: { date: string; description: string; category: string; detail: string; amount: string };
  total: string;
  /** "Generado el 24/10/2026 10:30". */
  generated: string;
  /** "Página 2 de 3". */
  page: (page: number, total: number) => string;
  category: (category: Expense['category']) => string;
  method: (method: NonNullable<Expense['method']>) => string;
  /** Un día `YYYY-MM-DD` como se lee en el idioma de la persona. */
  day: (dayKey: string) => string;
  /** Un importe en la moneda de la obra, ya con su símbolo. */
  money: (amount: number) => string;
}

export async function buildExpensesPdf(input: {
  projectName: string;
  /** Ya en el orden en que se muestran: por categoría y, dentro, como vengan. */
  expenses: Expense[];
  total: number;
  labels: ExpensesPdfLabels;
}): Promise<Blob> {
  const { projectName, expenses, total, labels } = input;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 15;

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
  let y = write(`${labels.title} - ${projectName}`, 20, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  y = write(labels.summary, y + 7, 10);
  if (labels.filtered) y = write(labels.filtered, y + 5, 10);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [
      [
        labels.columns.date,
        labels.columns.description,
        labels.columns.category,
        labels.columns.detail,
        labels.columns.amount,
      ],
    ],
    body: expenses.map((expense) => [
      sanitizeForPdf(labels.day(expense.spentOn)),
      sanitizeForPdf(expense.description),
      sanitizeForPdf(labels.category(expense.category)),
      sanitizeForPdf(
        [expense.method && labels.method(expense.method), expense.providerName, expense.activityName]
          .filter(Boolean)
          .join(' · '),
      ),
      sanitizeForPdf(labels.money(expense.amountInProjectCurrency)),
    ]),
    foot: [[{ content: sanitizeForPdf(labels.total), colSpan: 4 }, sanitizeForPdf(labels.money(total))]],
    showFoot: 'lastPage',
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, minCellHeight: 9, valign: 'middle' },
    headStyles: { fillColor: [16, 16, 16], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 26 },
      3: { cellWidth: 38 },
      4: { cellWidth: 28, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 4) data.cell.styles.halign = 'right';
    },
    // Un gasto corto no se parte entre dos hojas.
    rowPageBreak: 'avoid',
  });

  // "Página 2 de 3" y cuándo se generó, al final, cuando ya se sabe cuántas son.
  const pages = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  doc.setFontSize(9);
  doc.setTextColor(110);
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.text(sanitizeForPdf(labels.generated), margin, height - 10);
    doc.text(sanitizeForPdf(labels.page(page, pages)), width - margin, height - 10, { align: 'right' });
  }

  return doc.output('blob');
}
