import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: { find: vi.fn() } }));
vi.mock('../../models/StockMovement.js', () => ({
  StockMovement: { find: vi.fn(), insertMany: vi.fn() },
}));

const { MaterialItem } = await import('../../models/MaterialItem.js');
const { StockMovement } = await import('../../models/StockMovement.js');
const { currentStock, ensurePurchaseEntries } = await import(
  '../../services/inventory.service.js'
);

const material = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  name: 'Cemento ',
  unit: 'bolsa',
  quantity: 40,
  statusChangedAt: new Date('2026-11-02T08:00:00.000Z'),
  statusChangedBy: 'user-2',
  createdBy: 'user-1',
  updatedAt: new Date('2026-11-03T08:00:00.000Z'),
  ...over,
});

function selectable<T>(value: T) {
  return { select: vi.fn().mockResolvedValue(value) };
}

describe('ensurePurchaseEntries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin materiales en obra no toca el kardex', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([] as never);
    await ensurePurchaseEntries('p1');
    expect(StockMovement.find).not.toHaveBeenCalled();
    expect(StockMovement.insertMany).not.toHaveBeenCalled();
  });

  it('registra sólo los materiales que todavía no tienen su compra', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([material('m1'), material('m2')] as never);
    vi.mocked(StockMovement.find).mockReturnValue(selectable([{ material: 'm1' }]) as never);

    await ensurePurchaseEntries('p1');

    const [rows] = vi.mocked(StockMovement.insertMany).mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      project: 'p1',
      material: 'm2',
      kind: 'compra',
      quantity: 40,
      itemKey: 'cemento|bolsa',
      createdBy: 'user-2',
      occurredAt: new Date('2026-11-02T08:00:00.000Z'),
    });
  });

  it('un material viejo sin fecha de cambio entra con su última actualización y su creador', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material('m1', { statusChangedAt: undefined, statusChangedBy: undefined }),
    ] as never);
    vi.mocked(StockMovement.find).mockReturnValue(selectable([]) as never);

    await ensurePurchaseEntries('p1');

    const [rows] = vi.mocked(StockMovement.insertMany).mock.calls[0]!;
    expect(rows[0]).toMatchObject({
      createdBy: 'user-1',
      occurredAt: new Date('2026-11-03T08:00:00.000Z'),
    });
  });

  it('no falla si otro request la registró a la vez (clave duplicada)', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([material('m1')] as never);
    vi.mocked(StockMovement.find).mockReturnValue(selectable([]) as never);
    vi.mocked(StockMovement.insertMany).mockRejectedValue({ code: 11000 });
    await expect(ensurePurchaseEntries('p1')).resolves.toBeUndefined();
  });

  it('cualquier otro error sí sube', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([material('m1')] as never);
    vi.mocked(StockMovement.find).mockReturnValue(selectable([]) as never);
    vi.mocked(StockMovement.insertMany).mockRejectedValue(new Error('boom'));
    await expect(ensurePurchaseEntries('p1')).rejects.toThrow('boom');
  });
});

describe('currentStock', () => {
  it('suma el kardex: compra menos consumo', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([] as never);
    const at = new Date('2026-11-02T08:00:00.000Z');
    vi.mocked(StockMovement.find).mockResolvedValue([
      { itemKey: 'cemento|bolsa', name: 'Cemento', unit: 'bolsa', kind: 'compra', quantity: 40, occurredAt: at },
      { itemKey: 'cemento|bolsa', name: 'Cemento', unit: 'bolsa', kind: 'consumo', quantity: 15, occurredAt: at },
    ] as never);

    const [item] = await currentStock('p1');
    expect(item).toMatchObject({ itemKey: 'cemento|bolsa', stock: 25, received: 40, consumed: 15 });
  });
});
