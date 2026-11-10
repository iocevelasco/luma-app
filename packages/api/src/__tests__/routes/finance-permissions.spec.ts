import { describe, expect, it, vi } from 'vitest';
import { canInProject, type ProjectCapabilityContext, type ProjectRole } from '@luma/shared';
import type { NextFunction, Request, Response, Router } from 'express';

/**
 * Toma el `capabilityGate` que cada ruta de finanzas declara y lo corre con un
 * rol real: es lo que decide que abrirle los gastos al cliente no le abra el
 * resumen con margen ni la nómina (regla 3 de Plata).
 */
vi.mock('../../services/storage.service.js', () => ({
  signObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
  openObject: vi.fn(),
  uploadMaterialPhoto: vi.fn(),
  uploadProjectDocument: vi.fn(),
  uploadEvidencePhoto: vi.fn(),
  uploadMilestoneAttachment: vi.fn(),
  uploadSubscriptionReceipt: vi.fn(),
  StorageNotConfiguredError: class extends Error {},
}));

const { financeRouter } = await import('../../routes/payment.js');

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: (req: Request, res: Response, next: NextFunction) => unknown; name: string }[];
  };
};

function allows(method: string, path: string, role: ProjectRole, project: ProjectCapabilityContext): boolean {
  const layer = ((financeRouter as Router).stack as unknown as RouteLayer[]).find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  expect(layer, `no existe ${method.toUpperCase()} ${path}`).toBeDefined();
  const gate = layer!.route!.stack.find((s) => s.name === 'capabilityGate')?.handle;
  expect(gate, `${method.toUpperCase()} ${path} no tiene requireCapability`).toBeDefined();

  const req = {
    project,
    projectRole: role,
    projectReadOnly: false,
    can: (capability: never) => canInProject(role, capability, project),
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn();
  gate!(req, res, next);

  if (next.mock.calls.length > 0) return true;
  expect(res.status).toHaveBeenCalledWith(403);
  return false;
}

const CLOSED = { providersVisibleToClient: false, expensesVisibleToClient: false };
const EXPENSES_OPEN = { providersVisibleToClient: false, expensesVisibleToClient: true };

describe('GET /finance/expenses — el cliente sólo con el flag', () => {
  it('cerrado, el cliente no los lee; abierto, sí', () => {
    expect(allows('get', '/expenses', 'cliente', CLOSED)).toBe(false);
    expect(allows('get', '/expenses', 'cliente', EXPENSES_OPEN)).toBe(true);
  });

  it('con el flag abierto el cliente no los carga ni los borra', () => {
    expect(allows('post', '/expenses', 'cliente', EXPENSES_OPEN)).toBe(false);
    expect(allows('delete', '/expenses/:expenseId', 'cliente', EXPENSES_OPEN)).toBe(false);
  });
});

describe('GET /finance/summary y /payroll — nunca el cliente', () => {
  it('con los gastos abiertos siguen dando 403 al cliente', () => {
    expect(allows('get', '/summary', 'cliente', EXPENSES_OPEN)).toBe(false);
    expect(allows('get', '/payroll', 'cliente', EXPENSES_OPEN)).toBe(false);
  });

  it('gerente y contador los leen', () => {
    for (const role of ['gerente', 'contador'] as const) {
      expect(allows('get', '/summary', role, CLOSED)).toBe(true);
      expect(allows('get', '/payroll', role, CLOSED)).toBe(true);
    }
  });
});

describe('GET /finance/payments — el cliente hasta que se los cierren', () => {
  it('abiertos por defecto, y cerrados con paymentsVisibleToClient en false', () => {
    expect(allows('get', '/payments', 'cliente', CLOSED)).toBe(true);
    expect(allows('get', '/payments', 'cliente', { ...CLOSED, paymentsVisibleToClient: false })).toBe(false);
  });
});
