import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionState } from '@luma/shared';

/**
 * A quién se lleva derecho a crear su primera obra: sólo a la cuenta `noProject` del censo
 * (llegó a gestionar la suya) y sin obras. Los modelos y el estado de suscripción van
 * mockeados; lo que se prueba es el cruce.
 */
vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../../models/OrganizationMember.js', () => ({ OrganizationMember: { find: vi.fn() } }));
vi.mock('../../models/ProjectMembership.js', () => ({ ProjectMembership: { find: vi.fn() } }));
vi.mock('../../services/subscription.service.js', () => ({ statesFor: vi.fn() }));

const { User } = await import('../../models/User.js');
const { OrganizationMember } = await import('../../models/OrganizationMember.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { statesFor } = await import('../../services/subscription.service.js');
const { firstProjectPrompt } = await import('../../services/first-project.service.js');

function state(status: SubscriptionState['status']): SubscriptionState {
  return { status, canWrite: status !== 'vencida', accessUntil: null, trialDaysLeft: null };
}

function setup({
  email = 'persona@ejemplo.com',
  status = 'active',
  subscription = 'sin_iniciar',
  roles = [],
}: {
  email?: string;
  status?: string;
  subscription?: SubscriptionState['status'] | null;
  roles?: string[];
} = {}) {
  vi.mocked(User.findById).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ email, account_status: status }) }),
  } as never);
  vi.mocked(OrganizationMember.find).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve([{ organization: 'org-1' }]) }),
  } as never);
  vi.mocked(ProjectMembership.find).mockReturnValue({
    distinct: () => Promise.resolve(roles),
  } as never);
  vi.mocked(statesFor).mockResolvedValue(
    new Map(subscription === null ? [] : [['org-1', state(subscription)]]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('firstProjectPrompt', () => {
  it('sí: se registró y todavía no creó nada', async () => {
    setup();
    expect(await firstProjectPrompt('u1', 0)).toBe(true);
  });

  it('no: ya tiene obras a la vista (ni siquiera lee el resto)', async () => {
    setup();
    expect(await firstProjectPrompt('u1', 2)).toBe(false);
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('no: tiene membresía, aunque venciera o se le purgaran las obras', async () => {
    for (const subscription of ['prueba', 'activa', 'vencida', 'ilimitado'] as const) {
      setup({ subscription });
      expect(await firstProjectPrompt('u1', 0), subscription).toBe(false);
    }
  });

  it('no: llegó a participar en la obra de otro (empleado o cliente)', async () => {
    setup({ roles: ['supervisor'] });
    expect(await firstProjectPrompt('u1', 0)).toBe(false);
    setup({ roles: ['cliente'] });
    expect(await firstProjectPrompt('u1', 0)).toBe(false);
  });

  it('no: cuenta de prueba, de baja o inexistente', async () => {
    setup({ email: 'e2e-user@luma.test' });
    expect(await firstProjectPrompt('u1', 0)).toBe(false);
    setup({ status: 'inactive' });
    expect(await firstProjectPrompt('u1', 0)).toBe(false);
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    expect(await firstProjectPrompt('u1', 0)).toBe(false);
  });

  it('sí: sin ninguna Empresa con suscripción (sin_iniciar o ausente) y sin roles', async () => {
    setup({ subscription: null });
    expect(await firstProjectPrompt('u1', 0)).toBe(true);
  });
});
