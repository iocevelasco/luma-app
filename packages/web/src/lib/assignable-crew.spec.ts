import { describe, expect, it } from 'vitest';
import { crewOptionLabel, isAssignableCrew } from './assignable-crew';

describe('isAssignableCrew', () => {
  it('una persona activa se puede elegir', () => {
    expect(isAssignableCrew({ active: true })).toBe(true);
  });

  it('quien está dado de baja no', () => {
    expect(isAssignableCrew({ active: false })).toBe(false);
  });
});

describe('crewOptionLabel', () => {
  it('a un equipo le agrega el sufijo, a una persona no', () => {
    expect(crewOptionLabel({ name: 'Carlos Rodríguez', kind: 'equipo' }, 'Equipo')).toBe(
      'Carlos Rodríguez · Equipo',
    );
    expect(crewOptionLabel({ name: 'Ana', kind: 'persona' }, 'Equipo')).toBe('Ana');
  });
});
