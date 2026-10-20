import type { MaterialItem, MaterialStatus } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import {
  buildPurchaseRows,
  buildPurchaseText,
  countSuppliers,
  materialTab,
  organizeMaterials,
  supplierKey,
  type ActivityRef,
} from './materials';

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
    editable: false,
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


function withSupplier(
  id: string,
  supplier: string | undefined,
  status: MaterialStatus = 'pendiente',
  name = id,
): MaterialItem {
  return { ...material(id, status), name, supplier };
}

describe('supplierKey', () => {
  it('une mayúsculas, tildes y espacios de un mismo proveedor', () => {
    const key = supplierKey('Corralón Sur');
    expect(supplierKey(' corralon   sur ')).toBe(key);
    expect(supplierKey('CORRALÓN SUR')).toBe(key);
  });

  it('un proveedor vacío no tiene clave', () => {
    expect(supplierKey(undefined)).toBe('');
    expect(supplierKey('   ')).toBe('');
  });
});

describe('buildPurchaseRows', () => {
  it('ordena por proveedor y deja "sin proveedor" al final', () => {
    const rows = buildPurchaseRows([
      withSupplier('a', undefined),
      withSupplier('b', 'Ferretería Díaz'),
      withSupplier('c', 'Corralón Sur'),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows[2].supplier).toBeNull();
  });

  it('agrupa las grafías de un mismo proveedor y muestra la más repetida', () => {
    const rows = buildPurchaseRows([
      withSupplier('a', 'corralon sur', 'pendiente', 'A'),
      withSupplier('b', 'Corralón Sur', 'pendiente', 'B'),
      withSupplier('c', ' Corralón Sur ', 'pendiente', 'C'),
      withSupplier('d', 'Ferretería Díaz'),
    ]);
    expect(rows.slice(0, 3).map((r) => r.supplier)).toEqual([
      'Corralón Sur',
      'Corralón Sur',
      'Corralón Sur',
    ]);
    expect(countSuppliers(rows)).toBe(2);
  });

  it('dentro de un proveedor, lo ya pedido va después y se marca', () => {
    const rows = buildPurchaseRows([
      withSupplier('a', 'Corralón Sur', 'solicitado', 'Arena'),
      withSupplier('b', 'Corralón Sur', 'pendiente', 'Cemento'),
    ]);
    expect(rows.map((r) => [r.id, r.requested])).toEqual([
      ['b', false],
      ['a', true],
    ]);
  });
});

describe('buildPurchaseText', () => {
  it('lleva proveedor y marca lo ya pedido, igual que el PDF', () => {
    const rows = buildPurchaseRows([
      withSupplier('a', 'Corralón Sur', 'pendiente', 'Cemento'),
      withSupplier('b', 'Corralón Sur', 'solicitado', 'Arena'),
      withSupplier('c', undefined, 'pendiente', 'Pintura'),
    ]);
    const text = buildPurchaseText(rows, { unit: () => 'Unidad', requested: 'ya pedido' });
    expect(text.split('\n')).toEqual([
      '- Cemento: 1 Unidad · Corralón Sur',
      '- Arena: 1 Unidad · Corralón Sur (ya pedido)',
      '- Pintura: 1 Unidad',
    ]);
  });
});
