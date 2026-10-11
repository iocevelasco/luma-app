import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lo que importa de este servicio no es que inserte filas: es a QUIÉN le
 * llegan y, sobre todo, que avisar nunca pueda voltear la acción que lo
 * disparó.
 */
vi.mock('../../models/Notification.js', () => ({
  Notification: { insertMany: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../../models/ProjectMembership.js', () => ({
  ProjectMembership: { find: vi.fn() },
}));

const { Notification } = await import('../../models/Notification.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { notifyProject, unreadCountFor } = await import(
  '../../services/notification.service.js'
);

const PROJECT = { _id: 'project-1', createdBy: 'gerente-1' } as never;

function mockMemberships(rows: { user: string; role: string }[]) {
  vi.mocked(ProjectMembership.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(rows),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMemberships([]);
});

describe('notifyProject', () => {
  it('el gerente sale de createdBy, no de una membresía', async () => {
    // No tiene fila en ProjectMembership: si el servicio sólo mirara ahí,
    // el gerente no recibiría nunca nada.
    const created = await notifyProject({
      project: PROJECT,
      type: 'eventualidad',
      subjectName: 'Se cayó un caño',
      link: '/admin/proyectos/project-1/hitos',
      audience: ['gerente'],
      actorId: 'supervisor-1',
    });

    expect(created).toBe(1);
    const docs = vi.mocked(Notification.insertMany).mock.calls[0][0] as { user: string }[];
    expect(docs[0].user).toBe('gerente-1');
  });

  it('reparte a los roles invitados que pidió quien llama', async () => {
    mockMemberships([
      { user: 'supervisor-1', role: 'supervisor' },
      { user: 'cliente-1', role: 'cliente' },
    ]);

    await notifyProject({
      project: PROJECT,
      type: 'hito',
      subjectName: 'Terminó la estructura',
      link: '/admin/proyectos/project-1/hitos',
      audience: ['gerente', 'supervisor', 'cliente'],
      actorId: 'otro',
    });

    const docs = vi.mocked(Notification.insertMany).mock.calls[0][0] as { user: string }[];
    expect(docs.map((doc) => doc.user).sort()).toEqual([
      'cliente-1',
      'gerente-1',
      'supervisor-1',
    ]);
  });

  it('nadie se avisa a sí mismo', async () => {
    // Un badge que se enciende por tu propia acción enseña a ignorar el badge.
    mockMemberships([{ user: 'supervisor-1', role: 'supervisor' }]);

    await notifyProject({
      project: PROJECT,
      type: 'hito',
      subjectName: 'Algo',
      link: '/x',
      audience: ['gerente', 'supervisor'],
      actorId: 'gerente-1',
    });

    const docs = vi.mocked(Notification.insertMany).mock.calls[0][0] as { user: string }[];
    expect(docs.map((doc) => doc.user)).toEqual(['supervisor-1']);
  });

  it('no inserta nada si no queda nadie a quien avisar', async () => {
    await notifyProject({
      project: PROJECT,
      type: 'hito',
      subjectName: 'Algo',
      link: '/x',
      audience: ['gerente'],
      actorId: 'gerente-1',
    });

    expect(Notification.insertMany).not.toHaveBeenCalled();
  });

  it('no consulta membresías si sólo se avisa al gerente', async () => {
    await notifyProject({
      project: PROJECT,
      type: 'eventualidad',
      subjectName: 'Algo',
      link: '/x',
      audience: ['gerente'],
      actorId: 'supervisor-1',
    });

    expect(ProjectMembership.find).not.toHaveBeenCalled();
  });

  it('si el reparto falla, devuelve 0 y NO relanza', async () => {
    // Un 500 al cerrar una actividad porque no se pudo insertar un aviso sería
    // peor que el aviso que falta.
    vi.mocked(Notification.insertMany).mockRejectedValue(new Error('mongo caído'));
    mockMemberships([{ user: 'cliente-1', role: 'cliente' }]);

    await expect(
      notifyProject({
        project: PROJECT,
        type: 'hito',
        subjectName: 'Algo',
        link: '/x',
        audience: ['cliente'],
        actorId: 'gerente-1',
      }),
    ).resolves.toBe(0);
  });
});

describe('unreadCountFor', () => {
  it('cuenta sólo las sin leer de esa persona', async () => {
    vi.mocked(Notification.countDocuments).mockResolvedValue(3 as never);

    await expect(unreadCountFor('user-1')).resolves.toBe(3);
    expect(Notification.countDocuments).toHaveBeenCalledWith({ user: 'user-1', readAt: null });
  });
});
