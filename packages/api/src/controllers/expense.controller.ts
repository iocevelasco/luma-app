import type { Request, Response } from 'express';
import {
  createExpenseSchema,
  payrollQuerySchema,
  roundMoney,
  updateExpenseSchema,
  type Expense as ExpenseDTO,
} from '@luma/shared';
import { Expense, type IExpense } from '../models/Expense.js';
import { Activity } from '../models/Activity.js';
import { Provider } from '../models/Provider.js';
import { User } from '../models/User.js';
import type { IProject } from '../models/Project.js';
import { financeSummaryFor } from '../services/finance.service.js';
import { payrollFor } from '../services/payroll.service.js';
import {
  deleteObject,
  signObjectUrl,
  StorageNotConfiguredError,
  uploadProjectDocument,
} from '../services/storage.service.js';

/**
 * Gastos de la obra. **Todo este archivo va detrás de `expense.read` /
 * `expense.write`**, que el cliente no tiene: con el total cobrado y el total
 * gastado, su utilidad sale de una resta (regla 13).
 */

const RECEIPT_MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function todayKey(): string {
  return new Intl.DateTimeFormat('sv-SE').format(new Date());
}

async function toExpenseDTO(
  expense: IExpense,
  registeredByName: string,
  providerName?: string,
  activityName?: string,
): Promise<ExpenseDTO> {
  return {
    id: String(expense._id),
    projectId: String(expense.project),
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    exchangeRate: expense.exchangeRate,
    spentOn: expense.spentOn,
    providerId: expense.provider ? String(expense.provider) : undefined,
    providerName,
    activityId: expense.activity ? String(expense.activity) : undefined,
    activityName,
    receipt: expense.receipt
      ? {
          fileName: expense.receipt.fileName,
          contentType: expense.receipt.contentType,
          sizeBytes: expense.receipt.sizeBytes,
          // Firmada al vuelo. La `key` interna nunca sale en la respuesta.
          url: await signObjectUrl(expense.receipt.key),
        }
      : undefined,
    notes: expense.notes || undefined,
    amountInProjectCurrency: roundMoney(expense.amount * expense.exchangeRate),
    registeredBy: String(expense.registeredBy),
    registeredByName,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

/** Nombres de personas, proveedores y actividades en tres consultas, no 3×N. */
async function resolveNames(expenses: IExpense[]) {
  const userIds = [...new Set(expenses.map((e) => String(e.registeredBy)))];
  const providerIds = [...new Set(expenses.filter((e) => e.provider).map((e) => String(e.provider)))];
  const activityIds = [...new Set(expenses.filter((e) => e.activity).map((e) => String(e.activity)))];

  const [users, providers, activities] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name'),
    providerIds.length ? Provider.find({ _id: { $in: providerIds } }).select('name') : [],
    activityIds.length ? Activity.find({ _id: { $in: activityIds } }).select('name') : [],
  ]);

  return {
    users: new Map(users.map((u) => [String(u._id), u.name])),
    providers: new Map(providers.map((p) => [String(p._id), p.name])),
    activities: new Map(activities.map((a) => [String(a._id), a.name])),
  };
}

export async function listExpenses(req: Request, res: Response) {
  try {
    const project = req.project as IProject;

    const docs = await Expense.find({ project: project._id }).sort({ spentOn: -1 }).limit(300);
    const names = await resolveNames(docs);

    const expenses = await Promise.all(
      docs.map((doc) =>
        toExpenseDTO(
          doc,
          names.users.get(String(doc.registeredBy)) ?? '',
          doc.provider ? names.providers.get(String(doc.provider)) : undefined,
          doc.activity ? names.activities.get(String(doc.activity)) : undefined,
        ),
      ),
    );

    return res.json({ success: true, data: { expenses } });
  } catch (error) {
    console.error('❌ [EXPENSE] listExpenses:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Alta de gasto. Multipart con un campo `receipt` opcional — por eso los
 * montos llegan como string y el schema los convierte con `coerce`.
 */
export async function createExpense(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
  }

  const file = req.file;
  let extension: string | undefined;
  if (file) {
    extension = RECEIPT_MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      return res.status(400).json({
        success: false,
        error: 'Comprobante no soportado. Subí un PDF o una imagen .jpg, .png o .webp',
      });
    }
  }

  try {
    const project = req.project as IProject;
    const { providerId, activityId, ...rest } = parsed.data;

    // Un proveedor o una actividad de otra obra filtrarían su nombre a quien
    // no tiene acceso a ella.
    let provider: string | null = null;
    let providerName: string | undefined;
    if (providerId) {
      const found = await Provider.findOne({
        _id: providerId,
        organization: project.organization,
      }).select('name');
      if (!found) {
        return res.status(400).json({ success: false, error: 'El proveedor no es de tu Empresa' });
      }
      provider = String(found._id);
      providerName = found.name;
    }

    let activity: string | null = null;
    let activityName: string | undefined;
    if (activityId) {
      const found = await Activity.findOne({ _id: activityId, project: project._id }).select('name');
      if (!found) {
        return res.status(400).json({ success: false, error: 'La actividad no es de esta obra' });
      }
      activity = String(found._id);
      activityName = found.name;
    }

    // El archivo se sube después de validar: al revés, un gasto con la
    // actividad equivocada deja un comprobante huérfano en el bucket.
    let receipt = null;
    if (file && extension) {
      const { key } = await uploadProjectDocument({
        projectId: String(project._id),
        buffer: file.buffer,
        contentType: file.mimetype,
        extension,
      });
      receipt = {
        key,
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
      };
    }

    const expense = await Expense.create({
      project: project._id,
      ...rest,
      provider,
      activity,
      receipt,
      registeredBy: req.user.sub,
    });

    const user = await User.findById(req.user.sub).select('name');

    return res.status(201).json({
      success: true,
      data: {
        expense: await toExpenseDTO(expense, user?.name ?? '', providerName, activityName),
      },
    });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return res.status(503).json({
        success: false,
        error: 'La carga de comprobantes todavía no está configurada en este entorno',
      });
    }
    console.error('❌ [EXPENSE] createExpense:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Edita la ficha del gasto, nunca su comprobante. */
export async function updateExpense(req: Request, res: Response) {
  try {
    const parsed = updateExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const expense = await Expense.findOne({ _id: req.params.expenseId, project: project._id });

    if (!expense) {
      return res.status(404).json({ success: false, error: 'Gasto no encontrado' });
    }

    expense.set(parsed.data);
    await expense.save();

    const names = await resolveNames([expense]);

    return res.json({
      success: true,
      data: {
        expense: await toExpenseDTO(
          expense,
          names.users.get(String(expense.registeredBy)) ?? '',
          expense.provider ? names.providers.get(String(expense.provider)) : undefined,
          expense.activity ? names.activities.get(String(expense.activity)) : undefined,
        ),
      },
    });
  } catch (error) {
    console.error('❌ [EXPENSE] updateExpense:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Borra el gasto y su comprobante del bucket, para no dejar objetos huérfanos. */
export async function deleteExpense(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const expense = await Expense.findOne({ _id: req.params.expenseId, project: project._id });

    if (!expense) {
      return res.status(404).json({ success: false, error: 'Gasto no encontrado' });
    }

    if (expense.receipt) await deleteObject(expense.receipt.key);
    await Expense.findByIdAndDelete(expense._id);

    return res.json({ success: true, data: { id: String(expense._id) } });
  } catch (error) {
    console.error('❌ [EXPENSE] deleteExpense:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * El resumen económico completo, con margen. Es lo que **no** ve el cliente, y
 * por eso va detrás de `expense.read` y no de `payment.read`.
 */
export async function getFinanceSummary(req: Request, res: Response) {
  try {
    const project = req.project as IProject;

    return res.json({
      success: true,
      data: {
        summary: await financeSummaryFor(project._id as never, project.currency, todayKey()),
      },
    });
  } catch (error) {
    console.error('❌ [EXPENSE] getFinanceSummary:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Nómina calculada desde la asistencia. Ver `payroll.service.ts`. */
export async function getPayroll(req: Request, res: Response) {
  try {
    const parsed = payrollQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Rango inválido', details: parsed.error.issues });
    }

    const project = req.project as IProject;

    return res.json({
      success: true,
      data: {
        payroll: await payrollFor(
          project._id as never,
          parsed.data.from,
          parsed.data.to,
          project.currency,
        ),
      },
    });
  } catch (error) {
    console.error('❌ [EXPENSE] getPayroll:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
