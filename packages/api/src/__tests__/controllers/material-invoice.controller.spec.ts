import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Facturas de materiales: un gasto de categoría `material` con los materiales
 * que paga. Lo que se fija acá es lo que no puede vivir en Zod — estados,
 * pertenencia a la obra, quién borra — con los modelos mockeados.
 */
vi.mock('../../models/Expense.js', () => ({
  Expense: { create: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn(), find: vi.fn() },
}));
vi.mock('../../models/MaterialItem.js', () => ({
  MaterialItem: { find: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../../models/Provider.js', () => ({
  Provider: { findOne: vi.fn() },
}));
vi.mock('../../services/directory.service.js', () => ({
  visibleProviderFilter: vi.fn().mockResolvedValue({ organization: 'org-1' }),
}));
vi.mock('../../services/storage.service.js', () => ({
  uploadProjectDocument: vi.fn().mockResolvedValue({ key: 'k-1' }),
  signObjectUrl: vi.fn().mockResolvedValue('https://signed'),
  deleteObject: vi.fn(),
  StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
}));

const { Expense } = await import('../../models/Expense.js');
const { MaterialItem } = await import('../../models/MaterialItem.js');
const { uploadProjectDocument, deleteObject } = await import('../../services/storage.service.js');
const { createMaterialInvoice, deleteMaterialInvoice } = await import(
  '../../controllers/material-invoice.controller.js'
);
const { isAppError } = await import('../../utils/errors.js');

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);

function mockNext() {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}

function thrownBy(next: ReturnType<typeof mockNext>) {
  const error = next.mock.calls[0]?.[0];
  expect(isAppError(error)).toBe(true);
  return error as { code: string; status: number; details?: unknown };
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const PDF = { mimetype: 'application/pdf', originalname: 'factura.pdf', size: 1200, buffer: Buffer.from('x') };

function createReq(body: Record<string, unknown> = {}, file: unknown = PDF, canExpense = false): Request {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1', organization: 'org-1' },
    can: (capability: string) => capability !== 'expense.write' || canExpense,
    file,
    body: {
      materialIds: `${A},${B}`,
      amount: '15000',
      currency: 'ARS',
      exchangeRate: '1',
      spentOn: '2026-10-20',
      description: 'Factura corralón',
      ...body,
    },
  } as unknown as Request;
}

const material = (id: string, status: string) => ({ _id: id, status });

describe('createMaterialInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Expense.create).mockImplementation(
      async (doc: unknown) => ({ _id: 'e-1', ...(doc as object) }) as never,
    );
  });

  it('crea un gasto de categoría material con los materiales y el archivo', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'comprado'),
      material(B, 'en_obra'),
    ] as never);
    const res = mockRes();
    const next = mockNext();

    await createMaterialInvoice(createReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'material',
        materials: [A, B],
        amount: 15000,
        receipt: expect.objectContaining({ key: 'k-1', fileName: 'factura.pdf' }),
        registeredBy: 'user-1',
      }),
    );
    expect(MaterialItem.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 sin archivo, y no sube nada', async () => {
    const next = mockNext();
    await createMaterialInvoice(createReq({}, null), mockRes(), next);
    expect(thrownBy(next)).toMatchObject({ code: 'VALIDATION', status: 400 });
    expect(uploadProjectDocument).not.toHaveBeenCalled();
  });

  it('409 si algún material sigue Pendiente', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'pendiente'),
      material(B, 'comprado'),
    ] as never);
    const next = mockNext();

    await createMaterialInvoice(createReq(), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'CONFLICT', status: 409, details: { ids: [A] } });
    expect(uploadProjectDocument).not.toHaveBeenCalled();
    expect(Expense.create).not.toHaveBeenCalled();
  });

  it('409 con Solicitados si no se pide marcarlos comprados', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'solicitado'),
      material(B, 'comprado'),
    ] as never);
    const next = mockNext();

    await createMaterialInvoice(createReq(), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'CONFLICT', details: { ids: [A] } });
  });

  it('con markBought, los Solicitados pasan a Comprado', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'solicitado'),
      material(B, 'comprado'),
    ] as never);
    const next = mockNext();

    await createMaterialInvoice(createReq({ markBought: 'true' }), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
    expect(MaterialItem.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [A] }, project: 'project-1', status: 'solicitado' },
      { $set: expect.objectContaining({ status: 'comprado', statusChangedBy: 'user-1' }) },
    );
  });

  it('404 si un material no es de esta obra', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([material(A, 'comprado')] as never);
    const next = mockNext();
    await createMaterialInvoice(createReq(), mockRes(), next);
    expect(thrownBy(next)).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('deleteMaterialInvoice', () => {
  function deleteReq(canExpense: boolean): Request {
    return {
      user: { sub: 'user-1' },
      project: { _id: 'project-1' },
      params: { expenseId: 'e-1' },
      can: (capability: string) => capability !== 'expense.write' || canExpense,
    } as unknown as Request;
  }

  beforeEach(() => vi.clearAllMocks());

  it('sólo alcanza facturas de materiales de esta obra', async () => {
    vi.mocked(Expense.findOne).mockResolvedValue(null);
    const next = mockNext();

    await deleteMaterialInvoice(deleteReq(false), mockRes(), next);

    expect(Expense.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'e-1', project: 'project-1', category: 'material' }),
    );
    expect(thrownBy(next)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('403 si la cargó otra persona y no tiene expense.write', async () => {
    vi.mocked(Expense.findOne).mockResolvedValue({ _id: 'e-1', registeredBy: 'otro' } as never);
    const next = mockNext();

    await deleteMaterialInvoice(deleteReq(false), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(Expense.deleteOne).not.toHaveBeenCalled();
  });

  it('borra la propia, con su archivo', async () => {
    vi.mocked(Expense.findOne).mockResolvedValue({
      _id: 'e-1',
      registeredBy: 'user-1',
      receipt: { key: 'k-1' },
    } as never);
    const next = mockNext();

    await deleteMaterialInvoice(deleteReq(false), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith('k-1');
    expect(Expense.deleteOne).toHaveBeenCalledWith({ _id: 'e-1' });
  });

  it('con expense.write borra la de cualquiera', async () => {
    vi.mocked(Expense.findOne).mockResolvedValue({ _id: 'e-1', registeredBy: 'otro' } as never);
    const next = mockNext();
    await deleteMaterialInvoice(deleteReq(true), mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });
});
