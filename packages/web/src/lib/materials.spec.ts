import type { MaterialItem, MaterialStatus } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import { materialTab, organizeMaterials, type ActivityRef } from './materials';

function material(
  id: string,
  status: MaterialStatus,
  activityId: string | null = null,
  changedAt = '2026-10-01T10:00:00.000Z',
): MaterialItem {
  return {
    id,
    projectId: 'p1',
    activityId,
    name: id,
    quantity: 1,
    unit: 'un',
    status,
    statusChangedAt: changedAt,
    createdBy: 'u1',
    createdAt: changedAt,
    updatedAt: changedAt,
  };
}

const activities = new Map<string, ActivityRef>([
  ['late', { name: 'Terminaciones', startDate: '2026-12-01' }],
  ['early', { name: 'Fundaciones', startDate: '2026-10-20' }],
]);

const ids = (items: MaterialItem[]) => items.map((m) => m.id);

describe('materialTab', () => {
  it('pendiente y solicitado van a "por comprar"', () => {
    expect(materialTab('pendiente')).toBe('toBuy');
    expect(materialTab('solicitado')).toBe('toBuy');
  });

  it('comprado y en obra van a "comprados"', () => {
    expect(materialTab('comprado')).toBe('bought');
    expect(materialTab('en_obra')).toBe('bought');
  });
});

describe('organizeMaterials', () => {
  it('por comprar: la actividad que empieza antes primero, sin actividad al final', () => {
    const { toBuyGroups, toBuy } = organizeMaterials(
      [material('a', 'pendiente'), material('b', 'pendiente', 'late'), material('c', 'pendiente', 'early')],
      activities,
    );
    expect(toBuyGroups.map((g) => g.activityId)).toEqual(['early', 'late', null]);
    expect(ids(toBuy)).toEqual(['c', 'b', 'a']);
  });

  it('dentro de una actividad, lo que nadie pidió antes que lo ya solicitado', () => {
    const { toBuy } = organizeMaterials(
      [material('pedido', 'solicitado', 'early'), material('sin-pedir', 'pendiente', 'early')],
      activities,
    );
    expect(ids(toBuy)).toEqual(['sin-pedir', 'pedido']);
  });

  it('una actividad que ya no existe cuenta como "sin actividad"', () => {
    const { toBuyGroups } = organizeMaterials([material('a', 'pendiente', 'borrada')], activities);
    expect(toBuyGroups).toHaveLength(1);
    expect(toBuyGroups[0].activityId).toBeNull();
  });

  it('comprados: primero lo que falta que llegue, cada bloque con lo último que cambió arriba', () => {
    const { onTheWay, onSite, bought } = organizeMaterials(
      [
        material('obra-vieja', 'en_obra', null, '2026-09-01T10:00:00.000Z'),
        material('camino-viejo', 'comprado', null, '2026-09-02T10:00:00.000Z'),
        material('obra-nueva', 'en_obra', null, '2026-10-05T10:00:00.000Z'),
        material('camino-nuevo', 'comprado', null, '2026-10-03T10:00:00.000Z'),
      ],
      activities,
    );
    expect(ids(onTheWay)).toEqual(['camino-nuevo', 'camino-viejo']);
    expect(ids(onSite)).toEqual(['obra-nueva', 'obra-vieja']);
    expect(ids(bought)).toEqual(['camino-nuevo', 'camino-viejo', 'obra-nueva', 'obra-vieja']);
  });

  it('cada material cae en una sola pestaña', () => {
    const all = [
      material('p', 'pendiente'),
      material('s', 'solicitado', 'early'),
      material('c', 'comprado'),
      material('o', 'en_obra'),
    ];
    const { toBuy, bought } = organizeMaterials(all, activities);
    expect([...ids(toBuy), ...ids(bought)].sort()).toEqual(['c', 'o', 'p', 's']);
  });
});
