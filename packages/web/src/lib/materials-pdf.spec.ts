import { describe, expect, it } from 'vitest';
import { purchaseFileName, sanitizeForPdf } from './materials-pdf';

describe('sanitizeForPdf', () => {
  it('conserva ñ y acentos, que las fuentes estándar sí tienen', () => {
    expect(sanitizeForPdf('Corralón Sur — Piñón')).toBe('Corralón Sur - Piñón');
  });

  it('reemplaza lo típico y descarta lo que saldría como un cuadrado', () => {
    expect(sanitizeForPdf('“Cemento” ✓ 😀…')).toBe('"Cemento" ...');
  });
});

describe('purchaseFileName', () => {
  it('sin espacios ni acentos, con la fecha ISO', () => {
    expect(purchaseFileName('Casa Rivera — Etapa 2', new Date(2026, 9, 19))).toBe(
      'compras-casa-rivera-etapa-2-2026-10-19.pdf',
    );
  });

  it('una obra sin nombre no deja un archivo sin nombre', () => {
    expect(purchaseFileName('', new Date(2026, 9, 19))).toBe('compras-obra-2026-10-19.pdf');
  });
});
