import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IProject } from '../../models/Project.js';

/**
 * Reasignar el responsable mueve la cuadrilla: la Jornada espera a quien
 * está en `ActivityCrew`, así que sin esto seguiría esperando a la persona
 * vieja. Lo que fijan estos casos es qué NO se toca: los integrantes puestos
 * a mano.
 */
vi.mock('../../models/ActivityCrew.js', () => ({
  ActivityCrew: { find: vi.fn(), deleteMany: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../../models/CrewMember.js', () => ({
  CrewMember: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../services/directory.service.js', () => ({
  visibleCrewFilter: vi.fn(async () => ({ organization: 'org-1' })),
}));

const { ActivityCrew } = await import('../../models/ActivityCrew.js');
const { CrewMember } = await import('../../models/CrewMember.js');
const { moveCrewWithResponsible } = await import('../../services/activity-crew.service.js');

const project = { _id: 'project-1', organization: 'org-1' } as unknown as IProject;

function inCrew(...ids: string[]) {
  vi.mocked(ActivityCrew.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(ids.map((crewMember) => ({ crewMember }))),
  } as never);
}

function crewMatches(leaving: string[], joining: string | null) {
  vi.mocked(CrewMember.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(leaving.map((_id) => ({ _id }))),
  } as never);
  vi.mocked(CrewMember.findOne).mockReturnValue({
    select: vi.fn().mockResolvedValue(joining ? { _id: joining } : null),
  } as never);
}

function move(previous: { name: string; user?: string }, next: { name: string; user?: string }) {
  return moveCrewWithResponsible({ project, activityId: 'activity-1', previous, next });
}

describe('moveCrewWithResponsible', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saca al responsable anterior y mete al nuevo', async () => {
    inCrew('crew-ana');
    crewMatches(['crew-ana'], 'crew-bruno');

    await move({ name: 'Ana' }, { name: 'Bruno' });

    expect(ActivityCrew.deleteMany).toHaveBeenCalledWith({
      activity: 'activity-1',
      crewMember: { $in: ['crew-ana'] },
    });
    expect(ActivityCrew.updateOne).toHaveBeenCalledWith(
      { activity: 'activity-1', crewMember: 'crew-bruno' },
      { $setOnInsert: { activity: 'activity-1', crewMember: 'crew-bruno' } },
      { upsert: true },
    );
  });

  it('el anterior se busca sólo entre la cuadrilla de la tarea, por nombre', async () => {
    inCrew('crew-ana', 'crew-carla');
    crewMatches(['crew-ana'], null);

    await move({ name: 'Ana' }, { name: 'Bruno' });

    expect(CrewMember.find).toHaveBeenCalledWith({
      _id: { $in: ['crew-ana', 'crew-carla'] },
      name: 'Ana',
    });
    // Carla, puesta a mano, no entra en lo que se borra.
    expect(ActivityCrew.deleteMany).toHaveBeenCalledWith({
      activity: 'activity-1',
      crewMember: { $in: ['crew-ana'] },
    });
  });

  it('si el anterior nunca estuvo en la cuadrilla, no borra nada', async () => {
    inCrew('crew-carla');
    crewMatches([], 'crew-bruno');

    await move({ name: 'Ana' }, { name: 'Bruno' });

    expect(ActivityCrew.deleteMany).not.toHaveBeenCalled();
    expect(ActivityCrew.updateOne).toHaveBeenCalled();
  });

  it('si el nuevo ya estaba en la cuadrilla, no lo duplica', async () => {
    inCrew('crew-ana', 'crew-bruno');
    crewMatches(['crew-ana'], 'crew-bruno');

    await move({ name: 'Ana' }, { name: 'Bruno' });

    expect(ActivityCrew.deleteMany).toHaveBeenCalled();
    expect(ActivityCrew.updateOne).not.toHaveBeenCalled();
  });

  it('un responsable administrativo no entra a la cuadrilla, pero el anterior sale', async () => {
    inCrew('crew-ana');
    crewMatches(['crew-ana'], null);

    await move({ name: 'Ana' }, { name: 'Jose Mario', user: 'user-1' });

    expect(ActivityCrew.deleteMany).toHaveBeenCalled();
    expect(CrewMember.findOne).not.toHaveBeenCalled();
    expect(ActivityCrew.updateOne).not.toHaveBeenCalled();
  });

  it('si el anterior era administrativo no hay a quién sacar', async () => {
    inCrew('crew-carla');
    crewMatches([], 'crew-bruno');

    await move({ name: 'Jose Mario', user: 'user-1' }, { name: 'Bruno' });

    expect(CrewMember.find).not.toHaveBeenCalled();
    expect(ActivityCrew.deleteMany).not.toHaveBeenCalled();
    expect(ActivityCrew.updateOne).toHaveBeenCalled();
  });

  it('el responsable nuevo sin ficha en esta obra (nombre suelto) no rompe', async () => {
    inCrew('crew-ana');
    crewMatches(['crew-ana'], null);

    await move({ name: 'Ana' }, { name: 'Alguien de afuera' });

    expect(ActivityCrew.deleteMany).toHaveBeenCalled();
    expect(ActivityCrew.updateOne).not.toHaveBeenCalled();
  });

  it('el nuevo se busca activo y visible en esta obra', async () => {
    inCrew();
    crewMatches([], null);

    await move({ name: 'Ana' }, { name: 'Bruno' });

    expect(CrewMember.findOne).toHaveBeenCalledWith({
      organization: 'org-1',
      active: true,
      name: 'Bruno',
    });
  });

  it('si el responsable no cambió, no toca nada', async () => {
    await move({ name: 'Ana' }, { name: 'Ana' });

    expect(ActivityCrew.find).not.toHaveBeenCalled();
    expect(ActivityCrew.deleteMany).not.toHaveBeenCalled();
    expect(ActivityCrew.updateOne).not.toHaveBeenCalled();
  });
});
