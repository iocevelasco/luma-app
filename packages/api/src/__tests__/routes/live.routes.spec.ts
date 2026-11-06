import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, Router } from 'express';

/**
 * Los tests de los middlewares los prueban sueltos; nada decía que el router
 * los monte donde corresponde. Si alguien saca `publishLiveChanges` de
 * `/activities` o `/materials`, o el corte de las rutas de miembros, el tiempo
 * real o el corte por cambio de acceso se rompen en silencio. Acá se mira el
 * cableado de `projectRouter` sin levantar la app.
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
const { publishLiveChanges } = await import('../../middleware/live.middleware.js');
const { liveHub } = await import('../../services/live-hub.service.js');

type Layer = {
  handle: unknown;
  name: string;
  regexp?: RegExp;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown; name: string }[];
  };
};

const layers = (projectRouter as unknown as Router & { stack: Layer[] }).stack;

/** ¿`publishLiveChanges` está montado sobre este path de la obra? */
function publishesOn(path: string): boolean {
  return layers.some((layer) => layer.handle === publishLiveChanges && layer.regexp?.test(path));
}

/** Las capas `closeLive` de una ruta concreta. */
function closeLayersOf(method: string, path: string) {
  const layer = layers.find((l) => l.route?.path === path && l.route.methods[method]);
  expect(layer, `no existe ${method.toUpperCase()} ${path}`).toBeDefined();
  return layer!.route!.stack.filter((s) => s.name === 'closeLive');
}

describe('projectRouter — tiempo real', () => {
  it('Actividades y Materiales avisan a la obra tras cada escritura', () => {
    expect(publishesOn('/6aecf150de3f65241ef2207c/activities')).toBe(true);
    expect(publishesOn('/6aecf150de3f65241ef2207c/materials')).toBe(true);
  });

  it('lo que no va en vivo no publica', () => {
    expect(publishesOn('/6aecf150de3f65241ef2207c/budget')).toBe(false);
    expect(publishesOn('/6aecf150de3f65241ef2207c/finance')).toBe(false);
  });

  it('el stream está montado en /live', () => {
    const mounted = layers.some(
      (layer) => layer.name === 'router' && layer.regexp?.test('/6aecf150de3f65241ef2207c/live'),
    );
    expect(mounted).toBe(true);
  });

  it.each([
    ['post', '/:projectId/members'],
    ['patch', '/:projectId/members/:membershipId'],
    ['delete', '/:projectId/members/:membershipId'],
    ['delete', '/:projectId'],
    ['patch', '/:projectId'],
  ])('%s %s corta las conexiones de la obra al cambiar el acceso', (method, path) => {
    expect(closeLayersOf(method, path)).toHaveLength(1);
  });

  it('PATCH de la obra sólo corta si cambia un flag de visibilidad', () => {
    // Se ejecuta la capa montada en la ruta, no la función suelta: lo que
    // importa es que el `when` esté atado a *esta* ruta.
    const [layer] = closeLayersOf('patch', '/:projectId');
    const close = vi.spyOn(liveHub, 'closeProject').mockImplementation(() => {});

    const run = (body: unknown) => {
      const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as Response;
      const req = { project: { _id: 'p1' }, body } as unknown as Request;
      (layer.handle as (req: Request, res: Response, next: () => void) => void)(req, res, () => {});
      res.emit('finish');
    };

    run({ name: 'Otro nombre' });
    expect(close).not.toHaveBeenCalled();

    run({ providersVisibleToClient: true });
    expect(close).toHaveBeenCalledWith('p1', 'access-changed');
    close.mockRestore();
  });
});
