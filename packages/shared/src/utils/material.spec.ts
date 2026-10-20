import { describe, expect, it } from 'vitest';
import { isMaterialEditable } from './material.js';

describe('isMaterialEditable', () => {
  it('un pendiente que nadie movió se puede corregir', () => {
    expect(isMaterialEditable({ status: 'pendiente' })).toBe(true);
    expect(isMaterialEditable({ status: 'pendiente', statusChangedAt: null })).toBe(true);
  });

  it('un pendiente que ya cambió de estado alguna vez queda bloqueado', () => {
    // Pendiente → Solicitado → Pendiente: volver atrás no lo desbloquea.
    expect(
      isMaterialEditable({ status: 'pendiente', statusChangedAt: '2026-10-19T10:00:00.000Z' }),
    ).toBe(false);
    expect(isMaterialEditable({ status: 'pendiente', statusChangedAt: new Date() })).toBe(false);
  });

  it('cualquier otro estado queda bloqueado, tenga o no fecha de cambio', () => {
    // Con fecha: lo normal. Sin fecha: un material anterior a que existiera el campo.
    for (const status of ['solicitado', 'comprado', 'en_obra'] as const) {
      expect(isMaterialEditable({ status, statusChangedAt: new Date() })).toBe(false);
      expect(isMaterialEditable({ status })).toBe(false);
    }
  });
});
