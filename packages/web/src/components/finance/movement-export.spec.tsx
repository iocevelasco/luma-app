import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MovementExport } from './movement-export';

const labels = {
  download: 'Descargar', generating: 'Generando PDF…', pdf: 'PDF', csv: 'CSV (Excel)',
  pdfButton: 'Descargar PDF', csvButton: 'Descargar CSV',
};

function setup(overrides: Partial<Parameters<typeof MovementExport>[0]> = {}) {
  const props = {
    compact: false, generatingPdf: false, disabled: false,
    onPdf: vi.fn(), onCsv: vi.fn(), onWarm: vi.fn(), labels, ...overrides,
  };
  render(<MovementExport {...props} />);
  return props;
}

describe('MovementExport', () => {
  it('en escritorio es un solo botón con un menú de PDF y CSV', async () => {
    const props = setup();
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(props.onWarm).toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'CSV (Excel)' }));
    expect(props.onCsv).toHaveBeenCalledOnce();
    expect(props.onPdf).not.toHaveBeenCalled();
  });

  it('en el panel compacto son dos botones, uno por formato', async () => {
    const props = setup({ compact: true });
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));
    expect(props.onPdf).toHaveBeenCalledOnce();
    expect(props.onCsv).toHaveBeenCalledOnce();
  });

  it('sin nada que descargar, todo queda deshabilitado', () => {
    setup({ compact: true, disabled: true });
    expect((screen.getByRole('button', { name: 'Descargar PDF' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Descargar CSV' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
