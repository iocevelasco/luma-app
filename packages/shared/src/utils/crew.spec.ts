import { describe, expect, it } from 'vitest';
import { normalizePersonName, normalizePhone } from './crew.js';

describe('normalizePersonName', () => {
  it('iguala mayúsculas, tildes y espacios de más', () => {
    expect(normalizePersonName('  Juan   PÉREZ ')).toBe('juan perez');
    expect(normalizePersonName('Juan Perez')).toBe(normalizePersonName('juan pérez'));
  });

  it('no confunde nombres distintos', () => {
    expect(normalizePersonName('Juan Pérez')).not.toBe(normalizePersonName('Juana Pérez'));
  });

  it('trata la ñ como n: es lo que pasa al tipear sin teclado en castellano', () => {
    expect(normalizePersonName('Muñoz')).toBe('munoz');
  });
});

describe('normalizePhone', () => {
  it('se queda con los dígitos', () => {
    expect(normalizePhone('+54 11 5555-5555')).toBe('541155555555');
    expect(normalizePhone('(011) 4555.5555')).toBe('01145555555');
  });

  it('el mismo número escrito distinto da lo mismo', () => {
    expect(normalizePhone('+54 11 5555-5555')).toBe(normalizePhone('54 11 5555 5555'));
  });

  it('con menos de 6 dígitos no identifica a nadie', () => {
    expect(normalizePhone('0')).toBeUndefined();
    expect(normalizePhone('12345')).toBeUndefined();
    expect(normalizePhone('')).toBeUndefined();
    expect(normalizePhone(undefined)).toBeUndefined();
    expect(normalizePhone(null)).toBeUndefined();
  });
});
