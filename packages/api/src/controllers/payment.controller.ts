import type { Request, Response } from 'express';
import {
  createPaymentSchema,
  createPaymentScheduleItemSchema,
  roundMoney,
  updatePaymentScheduleItemSchema,
  type Payment as PaymentDTO,
  type PaymentScheduleItem as ScheduleItemDTO,
} from '@luma/shared';
import { Payment, type IPayment } from '../models/Payment.js';
import {
  PaymentScheduleItem,
  type IPaymentScheduleItem,
} from '../models/PaymentScheduleItem.js';
import { User } from '../models/User.js';
import type { IProject } from '../models/Project.js';
import {
  paidByScheduleItem,
  paymentSummaryFor,
  scheduleItemStatus,
} from '../services/finance.service.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/** Hoy en `YYYY-MM-DD`, para decidir qué cuota está vencida. */
function today(): string {
  // `toISOString` da UTC. Una obra en Buenos Aires a las 22h vería la cuota de
  // mañana como vencida hoy; `sv-SE` formatea ISO en la zona del servidor.
  return new Intl.DateTimeFormat('sv-SE').format(new Date());
}

function toScheduleItemDTO(
  item: IPaymentScheduleItem,
  paidAmount: number,
  todayKey: string,
): ScheduleItemDTO {
  const scheduledAmount = roundMoney(item.amount * item.exchangeRate);

  return {
    id: String(item._id),
    projectId: String(item.project),
    order: item.order,
    concept: item.concept,
    amount: item.amount,
    currency: item.currency,
    exchangeRate: item.exchangeRate,
    dueOn: item.dueOn,
    notes: item.notes || undefined,
    scheduledAmount,
    paidAmount,
    status: scheduleItemStatus(scheduledAmount, paidAmount, item.dueOn, todayKey),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toPaymentDTO(
  payment: IPayment,
  registeredByName: string,
  scheduleItemConcept?: string,
): PaymentDTO {
  return {
    id: String(payment._id),
    projectId: String(payment.project),
    scheduleItemId: payment.scheduleItem ? String(payment.scheduleItem) : undefined,
    scheduleItemConcept,
    amount: payment.amount,
    currency: payment.currency,
    exchangeRate: payment.exchangeRate,
    paidOn: payment.paidOn,
    method: payment.method,
    reference: payment.reference || undefined,
    notes: payment.notes || undefined,
    amountInProjectCurrency: roundMoney(payment.amount * payment.exchangeRate),
    registeredBy: String(payment.registeredBy),
    registeredByName,
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * El cronograma acordado más el resumen de cobros.
 *
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el
 * router antes. Lo ve el cliente: es su fila "revisar cronograma de pagos
 * acordado". **No trae ni una cifra de gasto** — ver `expense.controller.ts`.
 */
export async function listPaymentSchedule(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const todayKey = today();

    const [items, paid, summary] = await Promise.all([
      PaymentScheduleItem.find({ project: project._id }).sort({ dueOn: 1, order: 1 }),
      paidByScheduleItem(project._id as never),
      paymentSummaryFor(project._id as never, project.currency, todayKey),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map((item) =>
          toScheduleItemDTO(item, paid.get(String(item._id)) ?? 0, todayKey),
        ),
        summary,
      },
    });
  } catch (error) {
    console.error('❌ [PAYMENT] listPaymentSchedule:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function createPaymentScheduleItem(req: Request, res: Response) {
  try {
    const parsed = createPaymentScheduleItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;

    // Sin `order` explícito, va al final: el cronograma se arma en el orden en
    // que se acordaron las cuotas, no alfabéticamente.
    const order =
      parsed.data.order ?? (await PaymentScheduleItem.countDocuments({ project: project._id }));

    const item = await PaymentScheduleItem.create({
      project: project._id,
      ...parsed.data,
      order,
    });

    return res
      .status(201)
      .json({ success: true, data: { item: toScheduleItemDTO(item, 0, today()) } });
  } catch (error) {
    console.error('❌ [PAYMENT] createPaymentScheduleItem:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function updatePaymentScheduleItem(req: Request, res: Response) {
  try {
    const parsed = updatePaymentScheduleItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const item = await PaymentScheduleItem.findOne({
      _id: req.params.itemId,
      project: project._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, error: 'Cuota no encontrada' });
    }

    item.set(parsed.data);
    await item.save();

    const paid = await paidByScheduleItem(project._id as never);

    return res.json({
      success: true,
      data: { item: toScheduleItemDTO(item, paid.get(String(item._id)) ?? 0, today()) },
    });
  } catch (error) {
    console.error('❌ [PAYMENT] updatePaymentScheduleItem:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el
 * router antes.
 *
 * No se puede borrar una cuota que ya tiene cobros imputados: el cobro
 * quedaría apuntando a algo que no existe y el total cobrado seguiría
 * contándolo sin que nadie pueda ver contra qué. Hay que desimputar primero.
 */
export async function deletePaymentScheduleItem(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const item = await PaymentScheduleItem.findOne({
      _id: req.params.itemId,
      project: project._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, error: 'Cuota no encontrada' });
    }

    const hasPayments = await Payment.exists({ scheduleItem: item._id });
    if (hasPayments) {
      return res.status(409).json({
        success: false,
        error: 'Esa cuota ya tiene cobros registrados. Borrá los cobros primero.',
      });
    }

    await PaymentScheduleItem.findByIdAndDelete(item._id);

    return res.json({ success: true, data: { id: String(item._id) } });
  } catch (error) {
    console.error('❌ [PAYMENT] deletePaymentScheduleItem:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function listPayments(req: Request, res: Response) {
  try {
    const project = req.project as IProject;

    const payments = await Payment.find({ project: project._id }).sort({ paidOn: -1 }).limit(200);

    const [users, items] = await Promise.all([
      User.find({ _id: { $in: [...new Set(payments.map((p) => String(p.registeredBy)))] } }).select(
        'name',
      ),
      PaymentScheduleItem.find({ project: project._id }).select('concept'),
    ]);

    const names = new Map(users.map((user) => [String(user._id), user.name]));
    const concepts = new Map(items.map((item) => [String(item._id), item.concept]));

    return res.json({
      success: true,
      data: {
        payments: payments.map((payment) =>
          toPaymentDTO(
            payment,
            names.get(String(payment.registeredBy)) ?? '',
            payment.scheduleItem ? concepts.get(String(payment.scheduleItem)) : undefined,
          ),
        ),
      },
    });
  } catch (error) {
    console.error('❌ [PAYMENT] listPayments:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Registra un cobro recibido. Requiere `requireProjectAccess` + el
 * `requireCapability(...)` que declara el router antes.
 *
 * Los cobros **no se editan**: un cobro es un hecho con fecha, y corregirle el
 * monto in situ deja el saldo cuadrando con una historia que nadie vivió. Si
 * se cargó mal, se borra y se carga de nuevo.
 */
export async function createPayment(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { scheduleItemId, ...rest } = parsed.data;

    // Una cuota de otra obra imputada acá movería el saldo de una obra ajena.
    let scheduleItem: string | null = null;
    let concept: string | undefined;
    if (scheduleItemId) {
      const found = await PaymentScheduleItem.findOne({
        _id: scheduleItemId,
        project: project._id,
      }).select('concept');
      if (!found) {
        return res.status(400).json({ success: false, error: 'La cuota no es de esta obra' });
      }
      scheduleItem = String(found._id);
      concept = found.concept;
    }

    const payment = await Payment.create({
      project: project._id,
      ...rest,
      scheduleItem,
      registeredBy: req.user.sub,
    });

    const user = await User.findById(req.user.sub).select('name');

    return res.status(201).json({
      success: true,
      data: { payment: toPaymentDTO(payment, user?.name ?? '', concept) },
    });
  } catch (error) {
    console.error('❌ [PAYMENT] createPayment:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function deletePayment(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const payment = await Payment.findOne({ _id: req.params.paymentId, project: project._id });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Cobro no encontrado' });
    }

    await Payment.findByIdAndDelete(payment._id);

    return res.json({ success: true, data: { id: String(payment._id) } });
  } catch (error) {
    console.error('❌ [PAYMENT] deletePayment:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
