import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Capability } from '@luma/shared';

/**
 * Qué sale en el calendario de cada persona. Lo que estos tests cuidan: el
 * feed es otra puerta a los mismos datos que el panel, y no puede mostrar
 * nada que el rol de la persona no deje ver en esa obra.
 */
vi.mock('../../models/User.js', () => ({ User: { findOne: vi.fn() } }));
vi.mock('../../models/Activity.js', () => ({ Activity: { find: vi.fn() } }));
vi.mock('../../models/Milestone.js', () => ({ Milestone: { find: vi.fn() } }));
vi.mock('../../models/PaymentScheduleItem.js', () => ({ PaymentScheduleItem: { find: vi.fn() } }));
vi.mock('../../services/my-projects.service.js', () => ({ myProjectsWithAccess: vi.fn() }));
vi.mock('../../services/finance.service.js', async (original) => ({
  ...(await original<typeof import('../../services/finance.service.js')>()),
  paidByScheduleItem: vi.fn(),
}));

const { User } = await import('../../models/User.js');
const { Activity } = await import('../../models/Activity.js');
const { Milestone } = await import('../../models/Milestone.js');
const { PaymentScheduleItem } = await import('../../models/PaymentScheduleItem.js');
const { myProjectsWithAccess } = await import('../../services/my-projects.service.js');
const { paidByScheduleItem } = await import('../../services/finance.service.js');
const {
  accountForFeedToken,
  calendarEventsFor,
  feedWindow,
  hashFeedToken,
  looksLikeFeedToken,
  newFeedToken,
} = await import('../../services/calendar-feed.service.js');

const NOW = new Date('2026-11-20T12:00:00.000Z');
const UPDATED = new Date('2026-11-01T00:00:00.000Z');

/** `Model.find(...).select(...)` resuelve a estas filas. */
function rows(model: { find: unknown }, result: unknown[]) {
  vi.mocked(model.find as () => unknown).mockReturnValue({ select: vi.fn().mockResolvedValue(result) });
}

function project(capabilities: Capability[], name = 'Casa Pérez') {
  return { project: { _id: 'p1', name }, role: 'gerente', capabilities, readOnly: false };
}

beforeEach(() => {
  vi.resetAllMocks();
  rows(Activity, [
    { _id: 'a1', name: 'Losa', startDate: '2026-11-21', endDate: '2026-11-23', updatedAt: UPDATED },
  ]);
  rows(Milestone, [{ _id: 'm1', title: 'Obra gruesa', occurredOn: '2026-11-25', updatedAt: UPDATED }]);
  rows(PaymentScheduleItem, [
    { _id: 'i1', amount: 1000, exchangeRate: 1, dueOn: '2026-12-01', updatedAt: UPDATED },
    { _id: 'i2', amount: 500, exchangeRate: 1, dueOn: '2026-12-15', updatedAt: UPDATED },
  ]);
  // La primera cuota ya se cobró entera.
  vi.mocked(paidByScheduleItem).mockResolvedValue(new Map([['i1', 1000]]));
});

describe('calendarEventsFor', () => {
  it('con todas las capacidades: actividades, reuniones y cuotas sin cobrar', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([
      project(['activity.read', 'milestone.read', 'milestone.report', 'payment.read']),
    ] as never);

    const events = await calendarEventsFor('u1', 'es-ES', NOW);

    expect(events.map((e) => e.uid)).toEqual(['activity-a1@luma', 'meeting-m1@luma', 'due-i2@luma']);
    expect(events.find((e) => e.uid === 'meeting-m1@luma')?.summary).toBe('Reunión: Obra gruesa · Casa Pérez');
  });

  it('pide sólo las obras activas (ni archivadas ni de la papelera)', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([] as never);
    await calendarEventsFor('u1', 'es-ES', NOW);
    expect(myProjectsWithAccess).toHaveBeenCalledWith('u1', expect.objectContaining({ activeOnly: true }));
  });

  it('las actividades canceladas no salen y la ventana es de 30 días atrás a 365 adelante', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([project(['activity.read'])] as never);
    await calendarEventsFor('u1', 'es-ES', NOW);
    expect(Activity.find).toHaveBeenCalledWith({
      project: 'p1',
      status: { $ne: 'cancelada' },
      endDate: { $gte: '2026-10-21' },
      startDate: { $lte: '2027-11-20' },
    });
  });

  it('sin activity.read (el contador) no hay actividades', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([project(['payment.read'])] as never);
    const events = await calendarEventsFor('u1', 'es-ES', NOW);
    expect(Activity.find).not.toHaveBeenCalled();
    expect(events.every((e) => e.uid.startsWith('due-'))).toBe(true);
  });

  it('sin payment.read (cobros cerrados al cliente) no hay vencimientos', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([project(['activity.read', 'milestone.read'])] as never);
    await calendarEventsFor('u1', 'es-ES', NOW);
    expect(PaymentScheduleItem.find).not.toHaveBeenCalled();
  });

  it('quien no reporta hitos (el cliente) ve sólo las reuniones de audiencia cliente', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([project(['milestone.read'])] as never);
    await calendarEventsFor('u1', 'es-ES', NOW);
    expect(Milestone.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'reunion', audience: 'cliente' }));
  });

  it('el vencimiento lleva un título fijo: ni concepto, ni notas, ni monto', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([project(['payment.read'])] as never);
    const [due] = await calendarEventsFor('u1', 'pt', NOW);
    expect(due?.summary).toBe('Vencimento de parcela · Casa Pérez');
    expect(PaymentScheduleItem.find).toHaveBeenCalled();
    const selected = vi.mocked(PaymentScheduleItem.find).mock.results[0]!.value.select.mock.calls[0][0];
    expect(selected).not.toMatch(/concept|notes/);
  });

  it('una reunión no lleva asistentes', async () => {
    vi.mocked(myProjectsWithAccess).mockResolvedValue([project(['milestone.read', 'milestone.report'])] as never);
    await calendarEventsFor('u1', 'es-ES', NOW);
    const selected = vi.mocked(Milestone.find).mock.results[0]!.value.select.mock.calls[0][0];
    expect(selected).not.toMatch(/attendees|description/);
  });
});

describe('token del feed', () => {
  it('son 32 bytes en base64url y se guarda su SHA-256', () => {
    const { token, hash } = newFeedToken();
    expect(looksLikeFeedToken(token)).toBe(true);
    expect(hash).toBe(hashFeedToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('algo que no tiene forma de token no llega a la base', async () => {
    expect(await accountForFeedToken('../etc/passwd')).toBeNull();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('se busca por el hash, nunca por el token', async () => {
    const { token, hash } = newFeedToken();
    vi.mocked(User.findOne).mockResolvedValue(null);
    await accountForFeedToken(token);
    expect(User.findOne).toHaveBeenCalledWith({ calendarFeedTokenHash: hash });
  });

  it.each([
    ['deshabilitada', { enabled: false, account_status: 'active' }],
    ['inactiva', { enabled: true, account_status: 'inactive' }],
    ['purgada', { enabled: true, account_status: 'active', purgedAt: new Date() }],
  ])('una cuenta %s no tiene feed', async (_label, fields) => {
    vi.mocked(User.findOne).mockResolvedValue(fields as never);
    expect(await accountForFeedToken(newFeedToken().token)).toBeNull();
  });
});

describe('feedWindow', () => {
  it('30 días atrás y 365 adelante', () => {
    expect(feedWindow(NOW)).toEqual({ today: '2026-11-20', from: '2026-10-21', to: '2027-11-20' });
  });
});
