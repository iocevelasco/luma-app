import { describe, expect, it, vi } from 'vitest';
import { canInProject, type ProjectRole } from '@luma/shared';
import type { NextFunction, Request, Response, Router } from 'express';

/**
 * Los specs de controllers llaman al handler suelto, así que no prueban que la
 * ruta esté detrás del permiso correcto. Acá se toma el `capabilityGate` que
 * cada ruta declara y se corre con un rol real: es lo que decide si el cliente
 * lee Compras, y si sólo el gerente toca el flag que se lo abre.
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

const { materialRouter } = await import('../../routes/material.js');
const { projectRouter } = await import('../../routes/project.js');

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: (req: Request, res: Response, next: NextFunction) => unknown; name: string }[];
  };
};

/** El gate de capacidad de una ruta, o `undefined` si no declara ninguno. */
function gateOf(router: Router, method: string, path: string) {
  const layer = (router.stack as unknown as RouteLayer[]).find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  expect(layer, `no existe ${method.toUpperCase()} ${path}`).toBeDefined();
  return layer!.route!.stack.find((s) => s.name === 'capabilityGate')?.handle;
}

/** `true` si la ruta deja pasar a ese rol, `false` si responde 403. */
function allows(
  router: Router,
  method: string,
  path: string,
  role: ProjectRole,
  project: { providersVisibleToClient: boolean; purchasesVisibleToClient?: boolean },
): boolean {
  const gate = gateOf(router, method, path);
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

const CLOSED = { providersVisibleToClient: false, purchasesVisibleToClient: false };
const OPEN = { providersVisibleToClient: false, purchasesVisibleToClient: true };

describe('GET /materials/:id/photo — quién la lee', () => {
  const read = (role: ProjectRole, project = CLOSED) =>
    allows(materialRouter, 'get', '/:materialId/photo', role, project);

  it('el cliente no la lee con Compras cerrado, ni aunque tenga abiertos los proveedores', () => {
    expect(read('cliente', CLOSED)).toBe(false);
    expect(read('cliente', { ...CLOSED, providersVisibleToClient: true })).toBe(false);
  });

  it('el cliente la lee cuando el gerente le abrió Compras', () => {
    expect(read('cliente', OPEN)).toBe(true);
  });

  it('gerente y supervisor la leen; el contador, que no ve Compras, no', () => {
    expect(read('gerente')).toBe(true);
    expect(read('supervisor')).toBe(true);
    expect(read('contador', OPEN)).toBe(false);
  });
});

describe('POST y DELETE /materials/:id/photo — quién las cambia', () => {
  it('el cliente no puede subir ni quitar fotos, ni con Compras abierto', () => {
    expect(allows(materialRouter, 'post', '/:materialId/photo', 'cliente', OPEN)).toBe(false);
    expect(allows(materialRouter, 'delete', '/:materialId/photo', 'cliente', OPEN)).toBe(false);
  });

  it('gerente y supervisor pueden', () => {
    for (const role of ['gerente', 'supervisor'] as const) {
      expect(allows(materialRouter, 'post', '/:materialId/photo', role, CLOSED)).toBe(true);
      expect(allows(materialRouter, 'delete', '/:materialId/photo', role, CLOSED)).toBe(true);
    }
  });
});

describe('PATCH /projects/:projectId — el flag que abre Compras', () => {
  const edit = (role: ProjectRole) =>
    allows(projectRouter, 'patch', '/:projectId', role, OPEN);

  it('lo cambia sólo el gerente', () => {
    expect(edit('gerente')).toBe(true);
    for (const role of ['supervisor', 'contador', 'cliente'] as const) {
      expect(edit(role)).toBe(false);
    }
  });
});
