import { DriveError } from './google-drive';

/**
 * Una lista de Luma como Google Sheet nativa en el Drive de la persona (ADR-005 §4).
 *
 * No se sube el CSV para que Drive lo convierta: el CSV va con `;` y decimales con
 * coma (lo que espera Excel en español), y la conversión de Drive lo partiría o
 * leería mal los números según el idioma de la cuenta. Acá se crea la planilla
 * vacía con Drive y se escriben las celdas con la API de Sheets: los números
 * llegan como números y el texto como texto, en cualquier idioma.
 *
 * Alcanza con el permiso `drive.file`: la planilla la creó la app. Las celdas van
 * con `valueInputOption=RAW`, así que un nombre que empieza con `=` queda como
 * texto y nunca se ejecuta como fórmula.
 */

export type SheetCell = string | number;

/** Una lista lista para escribir: encabezado + filas, en el orden de la pantalla. */
export interface SheetTable {
  header: string[];
  rows: SheetCell[][];
}

export const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface CreatedSheet {
  id: string;
  webViewLink?: string;
}

async function failed(response: Response): Promise<never> {
  // El texto de Google dice qué falló (p. ej. la API de Sheets sin habilitar en el
  // proyecto de GCP); a la persona le llega el mensaje traducido.
  console.warn('[sheets]', response.status, await response.text().catch(() => ''));
  throw new DriveError('sheet');
}

export async function createSpreadsheet(
  token: string,
  { name, folderId, table }: { name: string; folderId: string; table: SheetTable },
): Promise<CreatedSheet> {
  const auth = { Authorization: `Bearer ${token}` };

  const created = await fetch(`${DRIVE_FILES}?fields=id,webViewLink&supportsAllDrives=true`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ name, mimeType: SPREADSHEET_MIME, parents: [folderId] }),
  });
  if (!created.ok) return failed(created);
  const sheet = (await created.json()) as CreatedSheet;

  // `A1` sin nombre de hoja es la primera, se llame "Hoja 1" o "Sheet1".
  const written = await fetch(`${SHEETS_API}/${encodeURIComponent(sheet.id)}/values/A1?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ values: [table.header, ...table.rows] }),
  });
  if (!written.ok) return failed(written);

  // Encabezado fijo y en negrita. Es cosmético: si falla, la planilla ya está.
  await fetch(`${SHEETS_API}/${encodeURIComponent(sheet.id)}:batchUpdate`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(headerFormatRequests(table.header.length)),
  }).catch(() => undefined);

  return sheet;
}

/** Congela la primera fila, la pone en negrita y ajusta el ancho de las columnas. */
export function headerFormatRequests(columns: number) {
  return {
    requests: [
      {
        updateSheetProperties: {
          properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      },
      {
        autoResizeDimensions: {
          dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: columns },
        },
      },
    ],
  };
}
