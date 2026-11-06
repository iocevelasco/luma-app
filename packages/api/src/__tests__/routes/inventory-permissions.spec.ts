import { describe, expect, it, vi } from 'vitest';
import { canInProject, type ProjectRole } from '@luma/shared';
import type { NextFunction, Request, Response, Router } from 'express';

/**
 * Los specs de controllers llaman al handler suelto, así que no prueban que la
 * ruta esté detrás del permiso correcto. Acá se corre el `capabilityGate` de
 * cada ruta con un rol real. Mismo patrón que `material-permissions.spec.ts`.
 */
const { inventoryRouter } = await import('../../routes/inventory.js');

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: (req: Request, res: Response, next: NextFunction) => unknown; name: string }[];
  };
};

function allows(
  router: Router,
  method: string,
  path: string,
  role: ProjectRole,
  isOwner = false,
): boolean {
  const layer = (router.stack as unknown as RouteLayer[]).find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  expect(layer, `no existe ${method.toUpperCase()} ${path}`).toBeDefined();
  const gate = layer!.route!.stack.find((s) => s.name === 'capabilityGate')?.handle;
  expect(gate, `${method.toUpperCase()} ${path} no tiene requireCapability`).toBeDefined();

  const project = { providersVisibleToClient: true, purchasesVisibleToClient: true };
  const req = {
    project,
    projectRole: role,
    projectReadOnly: false,
    can: (capability: never) => canInProject(role, capability, project, { isOwner }),
    isProjectOwner: isOwner,
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn();
  gate!(req, res, next);

  if (next.mock.calls.length > 0) return true;
  expect(res.status).toHaveBeenCalledWith(403);
  return false;
}

describe('inventario — quién entra', () => {
  it('lo leen todos menos el contador y el cliente, aunque Compras esté abierta al cliente', () => {
    for (const path of ['/stock', '/movements']) {
      for (const role of ['gerente', 'supervisor', 'arquitecto', 'ingeniero', 'disenador'] as const) {
        expect(allows(inventoryRouter, 'get', path, role), `${role} ${path}`).toBe(true);
      }
      for (const role of ['contador', 'cliente'] as const) {
        expect(allows(inventoryRouter, 'get', path, role), `${role} ${path}`).toBe(false);
      }
    }
  });

  it('registran gerente y supervisor; el resto no', () => {
    for (const role of ['gerente', 'supervisor'] as const) {
      expect(allows(inventoryRouter, 'post', '/movements', role)).toBe(true);
    }
    for (const role of ['arquitecto', 'ingeniero', 'disenador', 'contador', 'cliente'] as const) {
      expect(allows(inventoryRouter, 'post', '/movements', role), role).toBe(false);
    }
  });

  it('el kardex no se edita ni se borra: no hay esas rutas', () => {
    const methods = (inventoryRouter.stack as unknown as RouteLayer[])
      .filter((l) => l.route)
      .flatMap((l) => Object.keys(l.route!.methods));
    expect(methods).not.toContain('patch');
    expect(methods).not.toContain('put');
    expect(methods).not.toContain('delete');
  });
});

describe('Depósito General — quién mueve material', () => {
  const routes = [
    ['get', '/deposit'],
    ['post', '/deposit/send'],
    ['post', '/deposit/import'],
  ] as const;

  it('sólo el gerente dueño de la obra', () => {
    for (const [method, path] of routes) {
      expect(allows(inventoryRouter, method, path, 'gerente', true), `${method} ${path}`).toBe(true);
    }
  });

  it('otro gerente no: el Depósito es de la Empresa que es dueña de la obra', () => {
    for (const [method, path] of routes) {
      expect(allows(inventoryRouter, method, path, 'gerente', false), `${method} ${path}`).toBe(false);
    }
  });

  it('ni el supervisor que despacha del patio, ni los demás roles', () => {
    for (const [method, path] of routes) {
      for (const role of ['supervisor', 'arquitecto', 'ingeniero', 'disenador', 'contador', 'cliente'] as const) {
        expect(allows(inventoryRouter, method, path, role, true), `${role} ${method} ${path}`).toBe(false);
      }
    }
  });
});
