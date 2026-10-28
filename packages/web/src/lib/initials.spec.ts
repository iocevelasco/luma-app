import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('toma la inicial de las dos primeras palabras, en mayúscula', () => {
    expect(initials('Hernán Duarte')).toBe('HD');
    expect(initials('ana maría de los ángeles')).toBe('AM');
  });

  it('un solo nombre da una letra', () => {
    expect(initials('Cuadrilla')).toBe('C');
  });

  it('espacios de más o un nombre vacío no rompen', () => {
    expect(initials('  Luis   Benítez ')).toBe('LB');
    expect(initials('')).toBe('');
  });

  it('con un nombre vacío da el valor de reserva, que por defecto es nada', () => {
    expect(initials('', '?')).toBe('?');
    expect(initials('   ', '?')).toBe('?');
    expect(initials('Ana', '?')).toBe('A');
  });
});
