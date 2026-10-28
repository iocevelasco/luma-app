import { describe, expect, it } from 'vitest';
import { fitInBox, purchaseFileName, sanitizeForPdf } from './materials-pdf';

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

describe('purchaseFileName — extensión', () => {
  it('el CSV lleva el mismo nombre que el PDF, con su extensión', () => {
    expect(purchaseFileName('Casa Rivera', new Date(2026, 9, 19), 'compras', 'csv')).toBe(
      'compras-casa-rivera-2026-10-19.csv',
    );
  });
});

describe('fitInBox', () => {
  it('una foto apaisada ocupa el ancho del cuadro; una alta, el alto', () => {
    expect(fitInBox(400, 200, 20)).toEqual({ w: 20, h: 10 });
    expect(fitInBox(200, 400, 20)).toEqual({ w: 10, h: 20 });
  });

  it('una foto chica se agranda hasta el cuadro, sin deformarse', () => {
    expect(fitInBox(10, 10, 20)).toEqual({ w: 20, h: 20 });
  });

  it('con medidas inválidas devuelve el cuadro entero en vez de NaN', () => {
    expect(fitInBox(0, 0, 20)).toEqual({ w: 20, h: 20 });
  });
});
