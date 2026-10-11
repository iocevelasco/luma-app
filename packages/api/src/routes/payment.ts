import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { DOCUMENT_MAX_BYTES } from '@luma/shared';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  createExpense,
  createPayment,
  createPaymentScheduleItem,
  deleteExpense,
  deletePayment,
  deletePaymentScheduleItem,
  getFinanceSummary,
  getPayroll,
  listExpenses,
  listPaymentSchedule,
  listPayments,
  updateExpense,
  updatePaymentScheduleItem,
} from '../controllers/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES },
});

function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, error: 'El comprobante es demasiado grande (máximo 20MB)' });
  }
  next(err);
}

/**
 * Anidado bajo `/api/projects/:projectId/finance` — ver routes/project.ts.
 *
 * **Dos gates distintos, y la diferencia es el punto del módulo entero:**
 *
 * - `payment.*` — el cronograma acordado y los cobros. Lo ve el cliente.
 * - `expense.*` — los gastos, el resumen con margen y la nómina. El cliente
 *   **no**. Con el total cobrado y el total gastado, la utilidad del
 *   ejecutante sale de una resta (regla 13), así que no alcanza con esconder
 *   la pantalla: la ruta tiene que negarlo.
 *
 * Si alguna vez una ruta de gastos queda con `payment.read`, el cliente puede
 * calcular tu margen con un `curl`.
 */
export const financeRouter = Router({ mergeParams: true });

financeRouter.use(isAuthenticated, requireProjectAccess);

// ── Cobros: el cliente los ve ───────────────────────────────────────────────
financeRouter.get('/schedule', requireCapability('payment.read'), listPaymentSchedule);
financeRouter.post('/schedule', requireCapability('payment.write'), createPaymentScheduleItem);
financeRouter.patch(
  '/schedule/:itemId',
  requireCapability('payment.write'),
  updatePaymentScheduleItem,
);
financeRouter.delete(
  '/schedule/:itemId',
  requireCapability('payment.write'),
  deletePaymentScheduleItem,
);

financeRouter.get('/payments', requireCapability('payment.read'), listPayments);
financeRouter.post('/payments', requireCapability('payment.write'), createPayment);
// Sin PATCH: un cobro es un hecho con fecha. Se borra y se carga de nuevo.
financeRouter.delete('/payments/:paymentId', requireCapability('payment.write'), deletePayment);

// ── Gastos: el cliente NO los ve ────────────────────────────────────────────
financeRouter.get('/expenses', requireCapability('expense.read'), listExpenses);
financeRouter.post(
  '/expenses',
  requireCapability('expense.write'),
  upload.single('receipt'),
  handleUploadError,
  createExpense,
);
financeRouter.patch('/expenses/:expenseId', requireCapability('expense.write'), updateExpense);
financeRouter.delete('/expenses/:expenseId', requireCapability('expense.write'), deleteExpense);

// El resumen con margen y la nómina van con `expense.read`, nunca con
// `payment.read`: los dos exponen cuánto se gastó.
financeRouter.get('/summary', requireCapability('expense.read'), getFinanceSummary);
financeRouter.get('/payroll', requireCapability('expense.read'), getPayroll);

export default financeRouter;
