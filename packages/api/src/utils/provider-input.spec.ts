import { describe, expect, it } from 'vitest';
import { toNewProvider, toProviderUpdate } from './provider-input.js';

const base = {
  name: 'Juan',
  specialty: 'electricidad' as const,
  scope: 'organization' as const,
  phone: '11-5555',
};

describe('toNewProvider', () => {
  it('no guarda los campos opcionales en blanco', () => {
    const result = toNewProvider({ ...base, companyName: '', email: '', notes: '' });
    expect(result).toEqual(base);
    expect('companyName' in result).toBe(false);
  });

  it('descarta el detalle si el rubro no lo admite', () => {
    const result = toNewProvider({ ...base, customSpecialty: 'quedó de antes' });
    expect(result.customSpecialty).toBeUndefined();
  });

  it('conserva el detalle en «otra» y en «acabados»', () => {
    expect(toNewProvider({ ...base, specialty: 'otra', customSpecialty: 'Soldadura' }).customSpecialty).toBe('Soldadura');
    expect(toNewProvider({ ...base, specialty: 'acabados', customSpecialty: 'Yeso' }).customSpecialty).toBe('Yeso');
  });
});

describe('toProviderUpdate', () => {
  it("traduce '' a $unset: vaciar un campo lo borra", () => {
    expect(toProviderUpdate({ name: 'Juan', companyName: '' })).toEqual({
      name: 'Juan',
      $unset: { companyName: 1 },
    });
  });

  it('sin blancos ni cambio de rubro, no agrega $unset', () => {
    expect(toProviderUpdate({ phone: '11-1' })).toEqual({ phone: '11-1' });
  });

  it('pasar a un rubro sin detalle borra el customSpecialty', () => {
    expect(toProviderUpdate({ specialty: 'plomeria', customSpecialty: 'Soldadura' })).toEqual({
      specialty: 'plomeria',
      $unset: { customSpecialty: 1 },
    });
  });

  it('en «otra» deja el detalle como viene', () => {
    expect(toProviderUpdate({ specialty: 'otra', customSpecialty: 'Soldadura' })).toEqual({
      specialty: 'otra',
      customSpecialty: 'Soldadura',
    });
  });
});
