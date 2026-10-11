import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/LaborRecord.js', () => ({ LaborRecord: { find: vi.fn() } }));
vi.mock('../../models/CrewMember.js', () => ({ CrewMember: { find: vi.fn() } }));

const { LaborRecord } = await import('../../models/LaborRecord.js');
const { CrewMember } = await import('../../models/CrewMember.js');
const { payrollFor } = await import('../../services/payroll.service.js');

function mockRecords(rows: unknown[]) {
  vi.mocked(LaborRecord.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(rows),
  } as never);
}

function mockMembers(rows: unknown[]) {
  vi.mocked(CrewMember.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(rows),
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('payrollFor', () => {
  it('cuenta un día por fecha aunque haya estado en dos actividades', async () => {
    // El parte diario es por actividad: quien pasó por la cocina y el baño el
    // mismo martes aparece dos veces. Contarlo doble le pagaría el doble.
    mockRecords([
      { date: '2026-09-01', presentCrewMembers: ['juan'] },
      { date: '2026-09-01', presentCrewMembers: ['juan'] },
      { date: '2026-09-02', presentCrewMembers: ['juan'] },
    ]);
    mockMembers([{ _id: 'juan', name: 'Juan', dailyRate: 10000 }]);

    const payroll = await payrollFor('project-1', '2026-09-01', '2026-09-30', 'ARS');

    expect(payroll.lines[0].daysPresent).toBe(2);
    expect(payroll.total).toBe(20000);
  });

  it('a quien no tiene jornal lo deja afuera y lo cuenta aparte', async () => {
    // Un cero diría que trabaja gratis y el total parecería completo.
    mockRecords([{ date: '2026-09-01', presentCrewMembers: ['juan', 'sin-jornal'] }]);
    mockMembers([
      { _id: 'juan', name: 'Juan', dailyRate: 10000 },
      { _id: 'sin-jornal', name: 'Pedro', dailyRate: undefined },
    ]);

    const payroll = await payrollFor('project-1', '2026-09-01', '2026-09-30', 'ARS');

    expect(payroll.lines).toHaveLength(1);
    expect(payroll.missingRateCount).toBe(1);
    expect(payroll.total).toBe(10000);
  });

  it('ordena de mayor a menor costo', async () => {
    mockRecords([
      { date: '2026-09-01', presentCrewMembers: ['a', 'b'] },
      { date: '2026-09-02', presentCrewMembers: ['b'] },
    ]);
    mockMembers([
      { _id: 'a', name: 'Ana', dailyRate: 5000 },
      { _id: 'b', name: 'Beto', dailyRate: 8000 },
    ]);

    const payroll = await payrollFor('project-1', '2026-09-01', '2026-09-30', 'ARS');

    expect(payroll.lines.map((line) => line.name)).toEqual(['Beto', 'Ana']);
  });

  it('sin asistencia en el rango, total cero y sin consultar el roster', async () => {
    mockRecords([]);
    mockMembers([]);

    const payroll = await payrollFor('project-1', '2026-09-01', '2026-09-30', 'ARS');

    expect(payroll.total).toBe(0);
    expect(payroll.lines).toEqual([]);
  });
});
