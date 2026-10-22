import type { MaterialItem, MaterialStatus } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import {
  buildPurchaseRows,
  bulkActionsFor,
  buildPurchaseText,
  countSuppliers,
  materialTab,
  organizeMaterials,
  providerMatchFor,
  selectionState,
  supplierKey,
  supplierName,
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
    providerId: null,
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

describe('selectionState', () => {
  it('ninguno, algunos o todos', () => {
    const ids = ['a', 'b', 'c'];
    expect(selectionState(ids, new Set())).toBe('none');
    expect(selectionState(ids, new Set(['b']))).toBe('some');
    expect(selectionState(ids, new Set(['a', 'b', 'c', 'otro']))).toBe('all');
  });

  it('ignora lo seleccionado que no está en la lista', () => {
    expect(selectionState(['a'], new Set(['x']))).toBe('none');
  });
});

describe('bulkActionsFor', () => {
  const editable = (id: string) => ({ ...material(id, 'pendiente'), editable: true });

  it('ofrece el paso siguiente si todos están en el mismo estado', () => {
    expect(bulkActionsFor([editable('a'), editable('b')]).next).toBe('solicitado');
    expect(bulkActionsFor([material('a', 'comprado'), material('b', 'comprado')]).next).toBe('en_obra');
  });

  it('sin paso siguiente con estados mezclados o ya en obra', () => {
    expect(bulkActionsFor([editable('a'), material('b', 'solicitado')]).next).toBeNull();
    expect(bulkActionsFor([material('a', 'en_obra')]).next).toBeNull();
  });

  it('eliminar sólo si todos siguen editables', () => {
    expect(bulkActionsFor([editable('a'), editable('b')]).canDelete).toBe(true);
    expect(bulkActionsFor([editable('a'), material('b', 'pendiente')]).canDelete).toBe(false);
  });

  it('avisa si el cambio de estado bloquea a alguno', () => {
    expect(bulkActionsFor([editable('a'), material('b', 'pendiente')]).locksSome).toBe(true);
    expect(bulkActionsFor([material('a', 'solicitado')]).locksSome).toBe(false);
  });

  it('una selección vacía no ofrece nada', () => {
    expect(bulkActionsFor([])).toEqual({ next: null, canDelete: false, locksSome: false });
  });
});

describe('proveedor vinculado', () => {
  const linked = (id: string, providerName: string) => ({
    ...material(id, 'pendiente'),
    providerId: 'prov-1',
    providerName,
  });
  const written = (id: string, supplier: string) => ({ ...material(id, 'pendiente'), supplier });

  it('supplierName prefiere el del directorio', () => {
    expect(supplierName({ providerName: '800 Aluminio', supplier: 'viejo' })).toBe('800 Aluminio');
    expect(supplierName({ supplier: '  JDR ' })).toBe('JDR');
    expect(supplierName({ supplier: '   ' })).toBeNull();
  });

  it('agrupa el vinculado con el escrito a mano igual, con la grafía del directorio', () => {
    const rows = buildPurchaseRows([
      written('a', '800 aluminio'),
      written('b', '800 aluminio'),
      linked('c', '800 Aluminio'),
    ]);
    expect(rows.map((row) => row.supplier)).toEqual(['800 Aluminio', '800 Aluminio', '800 Aluminio']);
    expect(countSuppliers(rows)).toBe(1);
  });

  it('sugiere vincular sólo con el mismo nombre y si no está vinculado', () => {
    const providers = [
      { id: 'p1', name: 'JDR Ferretería' },
      { id: 'p2', name: '800 Aluminio' },
    ];
    expect(providerMatchFor(written('a', ' 800 ALUMINIO'), providers)?.id).toBe('p2');
    expect(providerMatchFor(written('a', 'JDR'), providers)).toBeNull();
    expect(providerMatchFor(linked('a', '800 Aluminio'), providers)).toBeNull();
  });
});
