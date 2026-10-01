import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El cálculo de "comprometido" vive en un servicio justamente porque antes
 * estaba duplicado y una copia quedó mal: el Consultor IA lo calculaba como
 * la suma de las líneas del presupuesto, que está validada para ser IGUAL al
 * total, así que siempre informaba 100%.
 */
vi.mock('../../models/ProviderEngagement.js', () => ({
  ProviderEngagement: { find: vi.fn() },
}));

const { ProviderEngagement } = await import('../../models/ProviderEngagement.js');
const { committedForProject } = await import('../../services/commitment.service.js');

function mockApproved(engagements: { quotedAmount?: number }[]) {
  vi.mocked(ProviderEngagement.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(engagements),
  } as never);
}

describe('committedForProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sólo mira contrataciones aprobadas', async () => {
    mockApproved([]);

    await committedForProject('project-1');

    expect(ProviderEngagement.find).toHaveBeenCalledWith({
      project: 'project-1',
      status: 'aprobada',
    });
  });

  it('suma lo cotizado', async () => {
    mockApproved([{ quotedAmount: 300_000 }, { quotedAmount: 120_500.5 }]);

    expect(await committedForProject('project-1')).toBe(420_500.5);
  });

  it('una aprobada sin monto no rompe la suma', async () => {
    mockApproved([{ quotedAmount: 50_000 }, {}]);

    expect(await committedForProject('project-1')).toBe(50_000);
  });

  it('sin contrataciones aprobadas el comprometido es cero, no el total', async () => {
    mockApproved([]);

    expect(await committedForProject('project-1')).toBe(0);
  });
});
