import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadSheet } from '@/hooks/google-drive/use-read-sheet';

/**
 * Lo que se prueba es el diálogo: Google (permiso, Picker y lectura) y la API
 * están detrás de los hooks, mockeados. Sin i18n inicializado, `t` devuelve la clave.
 */
const reader = { available: true, busy: false, read: vi.fn() };
let deliver: (sheet: ReadSheet) => void = () => undefined;
vi.mock('@/hooks/google-drive/use-read-sheet', () => ({
  useReadSheet: (onRead: (sheet: ReadSheet) => void) => {
    deliver = onRead;
    return reader;
  },
}));

const mutate = vi.fn();
vi.mock('@/hooks/materials/use-material-queries', () => ({
  useBulkCreateMaterials: () => ({ mutate, reset: vi.fn(), isPending: false, error: null }),
}));
vi.mock('@/components/ui/use-mobile', () => ({ useIsMobile: () => false }));

const { act } = await import('@testing-library/react');
const { MaterialImportButton } = await import('./material-import');

async function openWith(values: ReadSheet['values']) {
  render(<MaterialImportButton projectId="p1" />);
  await userEvent.click(screen.getByRole('button', { name: 'material.import.button' }));
  expect(reader.read).toHaveBeenCalled();
  act(() => deliver({ name: 'Lista de obra', values }));
}

describe('MaterialImportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reader.available = true;
  });

  it('sin Google Drive no se ofrece', () => {
    reader.available = false;
    render(<MaterialImportButton projectId="p1" />);
    expect(screen.queryByRole('button', { name: 'material.import.button' })).toBeNull();
  });

  it('muestra lo que va a añadir y las filas que salta, y manda sólo las válidas', async () => {
    await openWith([
      ['Material', 'Cantidad', 'Unidad'],
      ['Cemento', 10, 'bolsas'],
      ['', 3, 'un'],
    ]);

    expect(screen.getByText('Lista de obra')).toBeTruthy();
    expect(screen.getByText('Cemento')).toBeTruthy();
    expect(screen.getByText('material.import.skippedRow')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'material.import.submit' }));
    expect(mutate).toHaveBeenCalledWith(
      { items: [{ name: 'Cemento', quantity: 10, unit: 'bolsa' }] },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('si no encuentra las columnas, lo dice y deja elegir otra', async () => {
    await openWith([['Cosa', 'Otra'], ['a', 'b']]);

    expect(screen.getByText('material.import.reasons.noName')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'material.import.submit' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'material.import.pickOther' }));
    expect(reader.read).toHaveBeenCalledTimes(2);
  });
});
