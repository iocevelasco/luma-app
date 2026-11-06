import { describe, expect, it } from 'vitest';
import {
  MIN_PEOPLE_PER_CELL,
  classifyAccount,
  foldSmallRoles,
  membershipBucket,
  primaryStaffRole,
  type AccountFacts,
} from '../index';

const base: AccountFacts = {
  isTest: false,
  active: true,
  subscriptionStatus: null,
  projectRoles: [],
};

describe('classifyAccount', () => {
  it('una cuenta de prueba no cuenta, aunque tenga membresía', () => {
    expect(classifyAccount({ ...base, isTest: true, subscriptionStatus: 'activa' })).toBe('test');
  });

  it('una baja cuenta como baja, aunque tenga membresía', () => {
    expect(classifyAccount({ ...base, active: false, subscriptionStatus: 'prueba' })).toBe('inactive');
  });

  it('cualquier estado de suscripción menos sin_iniciar es membresía', () => {
    for (const status of ['prueba', 'activa', 'en_revision', 'pago_fallido', 'vencida', 'ilimitado'] as const) {
      expect(classifyAccount({ ...base, subscriptionStatus: status })).toBe('membership');
    }
  });

  it('sin_iniciar no es membresía: es un invitado', () => {
    expect(
      classifyAccount({ ...base, subscriptionStatus: 'sin_iniciar', projectRoles: ['cliente'] }),
    ).toBe('client');
  });

  it('la membresía propia gana sobre un rol en la obra de otro', () => {
    expect(
      classifyAccount({ ...base, subscriptionStatus: 'prueba', projectRoles: ['supervisor'] }),
    ).toBe('membership');
  });

  it('un rol que no es cliente la hace empleado, aunque también sea cliente en otra obra', () => {
    expect(classifyAccount({ ...base, projectRoles: ['cliente', 'contador'] })).toBe('staff');
    expect(classifyAccount({ ...base, projectRoles: ['gerente'] })).toBe('staff');
  });

  it('solo clientes es cliente', () => {
    expect(classifyAccount({ ...base, projectRoles: ['cliente', 'cliente'] })).toBe('client');
  });

  it('sin membresía ni obra queda sin obra', () => {
    expect(classifyAccount(base)).toBe('noProject');
  });
});

describe('membershipBucket', () => {
  it('agrupa los estados como el censo', () => {
    expect(membershipBucket('prueba')).toBe('trial');
    expect(membershipBucket('activa')).toBe('paying');
    expect(membershipBucket('en_revision')).toBe('paying');
    expect(membershipBucket('pago_fallido')).toBe('paying');
    expect(membershipBucket('ilimitado')).toBe('unlimited');
    expect(membershipBucket('vencida')).toBe('expired');
  });

  it('sin_iniciar no es una membresía', () => {
    expect(membershipBucket('sin_iniciar')).toBeNull();
  });
});

describe('primaryStaffRole', () => {
  it('elige el rol que más manda', () => {
    expect(primaryStaffRole(['contador', 'supervisor'])).toBe('supervisor');
    expect(primaryStaffRole(['cliente', 'gerente', 'contador'])).toBe('gerente');
  });

  it('un cliente o alguien sin obra no tiene rol de empleado', () => {
    expect(primaryStaffRole(['cliente'])).toBeNull();
    expect(primaryStaffRole([])).toBeNull();
  });
});

describe('foldSmallRoles', () => {
  it('deja los roles que llegan al mínimo', () => {
    expect(foldSmallRoles({ supervisor: 31, contador: MIN_PEOPLE_PER_CELL })).toEqual([
      { role: 'supervisor', people: 31 },
      { role: 'contador', people: MIN_PEOPLE_PER_CELL },
    ]);
  });

  it('funde los roles chicos en "otros" cuando juntos llegan al mínimo', () => {
    expect(foldSmallRoles({ supervisor: 20, ingeniero: 3, disenador: 2 })).toEqual([
      { role: 'supervisor', people: 20 },
      { role: 'other', people: 5 },
    ]);
  });

  it('omite "otros" si tampoco llega: un 3 suelto sería una celda chica', () => {
    expect(foldSmallRoles({ supervisor: 20, disenador: 3 })).toEqual([
      { role: 'supervisor', people: 20 },
    ]);
  });

  it('un rol sin nadie no aparece', () => {
    expect(foldSmallRoles({})).toEqual([]);
  });

  it('acepta otro mínimo', () => {
    expect(foldSmallRoles({ supervisor: 2 }, 2)).toEqual([{ role: 'supervisor', people: 2 }]);
  });
});
