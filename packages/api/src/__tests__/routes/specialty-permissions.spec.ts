import { describe, expect, it, vi } from 'vitest';
import { capabilitiesInProject, type ProjectRole } from '@luma/shared';
import type { NextFunction, Request, Response, Router } from 'express';

/**
 * Las especialidades propias las gestiona el gerente. Se corre el gate de
 * capacidad que declara cada ruta con un rol real, y con la obra en sólo lectura
 * (suscripción vencida), igual que `material-permissions.spec.ts`.
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

const { projectRouter } = await import('../../routes/project.js');

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: (req: Request, res: Response, next: NextFunction) => unknown; name: string }[];
  };
};

function allows(method: string, path: string, role: ProjectRole, readOnly = false): boolean {
  const layer = ((projectRouter as Router).stack as unknown as RouteLayer[]).find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  expect(layer, `no existe ${method.toUpperCase()} ${path}`).toBeDefined();
  const gate = layer!.route!.stack.find((s) => s.name === 'capabilityGate')?.handle;
  expect(gate, `${method.toUpperCase()} ${path} no tiene requireCapability`).toBeDefined();

  const project = { providersVisibleToClient: false, purchasesVisibleToClient: false };
  const req = {
    project,
    projectRole: role,
    projectReadOnly: readOnly,
    // Lo mismo que resuelve `requireProjectAccess`: las capacidades ya recortadas.
    can: (capability: never) =>
      capabilitiesInProject(role, project, { readOnly }).includes(capability),
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn();
  gate!(req, res, next);
  return next.mock.calls.length > 0;
}

describe('especialidades propias de la obra — quién las gestiona', () => {
  const routes = [
    ['post', '/:projectId/specialties'],
    ['patch', '/:projectId/specialties/:key'],
  ] as const;

  it('el gerente sí', () => {
    for (const [method, path] of routes) expect(allows(method, path, 'gerente'), path).toBe(true);
  });

  it('nadie más: ni supervisor, ni profesionales, ni contador, ni cliente', () => {
    for (const role of ['supervisor', 'arquitecto', 'ingeniero', 'disenador', 'contador', 'cliente'] as const) {
      for (const [method, path] of routes) expect(allows(method, path, role), `${role} ${path}`).toBe(false);
    }
  });

  it('con la suscripción vencida ni el gerente: la obra queda en sólo lectura', () => {
    for (const [method, path] of routes) expect(allows(method, path, 'gerente', true), path).toBe(false);
  });
});
