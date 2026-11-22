import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriveError } from './google-drive';
import { createSpreadsheet, headerFormatRequests, SPREADSHEET_MIME } from './google-sheets';

const table = { header: ['Material', 'Cantidad'], rows: [['=HYPERLINK("x")', 2.5]] };

function json(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 403, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('createSpreadsheet', () => {
  it('crea la planilla en la carpeta y escribe las celdas tal cual, con los números como números', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 's1', webViewLink: 'https://docs.google.com/s1' }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}));
    vi.stubGlobal('fetch', fetchMock);

    const sheet = await createSpreadsheet('tok', { name: 'compras-obra', folderId: 'f1', table });

    expect(sheet).toEqual({ id: 's1', webViewLink: 'https://docs.google.com/s1' });
    const [createUrl, createInit] = fetchMock.mock.calls[0]!;
    expect(createUrl).toContain('drive/v3/files');
    expect(JSON.parse(createInit.body)).toEqual({ name: 'compras-obra', mimeType: SPREADSHEET_MIME, parents: ['f1'] });
    expect(createInit.headers.Authorization).toBe('Bearer tok');

    const [valuesUrl, valuesInit] = fetchMock.mock.calls[1]!;
    // RAW: un texto que empieza con `=` no se ejecuta como fórmula.
    expect(valuesUrl).toBe('https://sheets.googleapis.com/v4/spreadsheets/s1/values/A1?valueInputOption=RAW');
    expect(JSON.parse(valuesInit.body)).toEqual({ values: [['Material', 'Cantidad'], ['=HYPERLINK("x")', 2.5]] });
  });

  it('si Google rechaza, falla con el código traducible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'SERVICE_DISABLED' }, false)));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(createSpreadsheet('tok', { name: 'x', folderId: 'f', table })).rejects.toEqual(new DriveError('sheet'));
  });

  it('el formato del encabezado es cosmético: si falla, la planilla igual se entrega', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ id: 's1' }))
        .mockResolvedValueOnce(json({}))
        .mockRejectedValueOnce(new TypeError('offline')),
    );
    await expect(createSpreadsheet('tok', { name: 'x', folderId: 'f', table })).resolves.toEqual({ id: 's1' });
  });
});

describe('headerFormatRequests', () => {
  it('congela y ajusta sólo las columnas de la tabla', () => {
    const { requests } = headerFormatRequests(5);
    expect(requests[0]!.updateSheetProperties!.properties.gridProperties.frozenRowCount).toBe(1);
    expect(requests[2]!.autoResizeDimensions!.dimensions.endIndex).toBe(5);
  });
});
