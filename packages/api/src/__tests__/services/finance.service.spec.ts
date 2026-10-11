import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El nudo de este servicio es que nada se guarda: todo se recalcula. Lo que
 * hay que fijar es la conversión de monedas (cada movimiento con la cotización
 * del día en que pasó) y el estado de cada cuota.
 */
vi.mock('../../models/Payment.js', () => ({ Payment: { find: vi.fn() } }));
vi.mock('../../models/Expense.js', () => ({ Expense: { find: vi.fn() } }));
vi.mock('../../models/PaymentScheduleItem.js', () => ({
  PaymentScheduleItem: { find: vi.fn() },
}));
vi.mock('../../models/Budget.js', () => ({ Budget: { findOne: vi.fn() } }));
vi.mock('../../services/commitment.service.js', () => ({ committedForProject: vi.fn() }));

const { Payment } = await import('../../models/Payment.js');
const { Expense } = await import('../../models/Expense.js');
const { PaymentScheduleItem } = await import('../../models/PaymentScheduleItem.js');
const { Budget } = await import('../../models/Budget.js');
const { committedForProject } = await import('../../services/commitment.service.js');
const { financeSummaryFor, paidByScheduleItem, paymentSummaryFor, scheduleItemStatus } =
  await import('../../services/finance.service.js');

function mockPayments(rows: unknown[]) {
  vi.mocked(Payment.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(rows),
  } as never);
}

function mockSchedule(rows: unknown[]) {
  vi.mocked(PaymentScheduleItem.find).mockReturnValue({
    sort: vi.fn().mockResolvedValue(rows),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(committedForProject).mockResolvedValue(0);
  vi.mocked(Budget.findOne).mockReturnValue({
    sort: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue(null) }),
  } as never);
});

describe('scheduleItemStatus', () => {
  it('sin cobros y antes del vencimiento: pendiente', () => {
    expect(scheduleItemStatus(1000, 0, '2026-12-01', '2026-10-10')).toBe('pendiente');
  });

  it('sin cobros y pasada la fecha: vencido', () => {
    expect(scheduleItemStatus(1000, 0, '2026-09-01', '2026-10-10')).toBe('vencido');
  });

  it('con algo cobrado y pasada la fecha sigue siendo parcial, no vencido', () => {
    // Una cuota a la que se le pagó algo tarde es otra conversación que una
    // que nadie tocó.
    expect(scheduleItemStatus(1000, 400, '2026-09-01', '2026-10-10')).toBe('parcial');
  });

  it('cobrada no vence aunque la fecha haya pasado', () => {
    expect(scheduleItemStatus(1000, 1000, '2026-09-01', '2026-10-10')).toBe('cobrado');
  });

  it('tolera un centavo de redondeo entre monedas', () => {
    // Sumar conversiones puede dejar la cuota a 0.004 de cerrar; mostrarla
    // "parcial" para siempre sería mentir por un error de redondeo.
    expect(scheduleItemStatus(1000, 999.995, '2026-12-01', '2026-10-10')).toBe('cobrado');
  });
});

describe('paidByScheduleItem', () => {
  it('convierte cada cobro con SU cotización antes de sumar', async () => {
    // 100 USD a 1000 + 50.000 ARS a 1 = 150.000 en la moneda de la obra.
    mockPayments([
      { scheduleItem: 'cuota-1', amount: 100, exchangeRate: 1000 },
      { scheduleItem: 'cuota-1', amount: 50000, exchangeRate: 1 },
    ]);

    const result = await paidByScheduleItem('project-1');

    expect(result.get('cuota-1')).toBe(150000);
  });
});

describe('paymentSummaryFor', () => {
  it('el total cobrado incluye los cobros a cuenta, sin cuota imputada', async () => {
    // Si sólo sumara lo imputado, el saldo mostraría una deuda ya pagada.
    mockSchedule([
      { _id: 'cuota-1', amount: 1000, exchangeRate: 1, dueOn: '2026-11-01', concept: 'Anticipo' },
    ]);
    vi.mocked(Payment.find)
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([]) } as never)
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([{ amount: 300, exchangeRate: 1 }]),
      } as never);

    const summary = await paymentSummaryFor('project-1', 'ARS', '2026-10-10');

    expect(summary.paidTotal).toBe(300);
    expect(summary.pendingTotal).toBe(700);
  });

  it('el pendiente puede ser negativo si el cliente pagó de más', async () => {
    // Mostrarlo como 0 taparía justo el caso que hay que devolver o imputar.
    mockSchedule([
      { _id: 'cuota-1', amount: 1000, exchangeRate: 1, dueOn: '2026-11-01', concept: 'Anticipo' },
    ]);
    vi.mocked(Payment.find)
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([]) } as never)
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([{ amount: 1200, exchangeRate: 1 }]),
      } as never);

    const summary = await paymentSummaryFor('project-1', 'ARS', '2026-10-10');

    expect(summary.pendingTotal).toBe(-200);
  });

  it('la próxima cuota es la primera no cobrada', async () => {
    mockSchedule([
      { _id: 'c1', amount: 500, exchangeRate: 1, dueOn: '2026-09-01', concept: 'Anticipo' },
      { _id: 'c2', amount: 500, exchangeRate: 1, dueOn: '2026-11-01', concept: 'Avance 1' },
    ]);
    vi.mocked(Payment.find)
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([{ scheduleItem: 'c1', amount: 500, exchangeRate: 1 }]),
      } as never)
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue([{ amount: 500, exchangeRate: 1 }]),
      } as never);

    const summary = await paymentSummaryFor('project-1', 'ARS', '2026-10-10');

    expect(summary.nextDue?.concept).toBe('Avance 1');
  });

  it('no trae ni una cifra de gasto', async () => {
    // Es lo que ve el cliente: con cobros y gastos despeja el margen restando.
    mockSchedule([]);
    vi.mocked(Payment.find).mockReturnValue({ select: vi.fn().mockResolvedValue([]) } as never);

    const summary = await paymentSummaryFor('project-1', 'ARS', '2026-10-10');

    expect(summary).not.toHaveProperty('expenseTotal');
    expect(summary).not.toHaveProperty('marginTotal');
  });
});

describe('financeSummaryFor', () => {
  it('el margen es cobrado menos gastado', async () => {
    mockSchedule([]);
    vi.mocked(Payment.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([{ amount: 100000, exchangeRate: 1 }]),
    } as never);
    vi.mocked(Expense.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { category: 'material', amount: 30000, exchangeRate: 1 },
        { category: 'nomina', amount: 20000, exchangeRate: 1 },
      ]),
    } as never);

    const summary = await financeSummaryFor('project-1', 'ARS', '2026-10-10');

    expect(summary.expenseTotal).toBe(50000);
    expect(summary.marginTotal).toBe(50000);
    expect(summary.expensesByCategory.material).toBe(30000);
    expect(summary.expensesByCategory.nomina).toBe(20000);
    expect(summary.expensesByCategory.herramienta).toBe(0);
  });

  it('agrupa gastos en monedas distintas convirtiendo cada uno', async () => {
    mockSchedule([]);
    vi.mocked(Payment.find).mockReturnValue({ select: vi.fn().mockResolvedValue([]) } as never);
    vi.mocked(Expense.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { category: 'material', amount: 100, exchangeRate: 1000 },
        { category: 'material', amount: 25000, exchangeRate: 1 },
      ]),
    } as never);

    const summary = await financeSummaryFor('project-1', 'ARS', '2026-10-10');

    expect(summary.expensesByCategory.material).toBe(125000);
  });
});
