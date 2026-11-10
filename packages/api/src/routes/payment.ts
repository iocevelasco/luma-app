import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  handleReceiptUploadError as handleUploadError,
  receiptUpload as upload,
} from '../middleware/receipt-upload.middleware.js';
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

/**
 * Anidado bajo `/api/projects/:projectId/finance` — ver routes/project.ts.
 *
 * **Dos gates distintos, y la diferencia es el punto del módulo entero:**
 *
 * - `payment.*` — el cronograma acordado y los cobros. Lo ve el cliente, salvo
 *   que el gerente se los cierre (`paymentsVisibleToClient`).
 * - `expense.*` — los gastos y sus comprobantes. El cliente sólo si el gerente
 *   se los abre (`expensesVisibleToClient`, cerrado por default): con el total
 *   cobrado y el total gastado, la utilidad del ejecutante sale de una resta
 *   (regla 13), así que es una decisión de la obra y la ruta tiene que
 *   respetarla, no alcanza con esconder la pantalla.
 * - `finance.summary.read` — el resumen con el margen y la nómina. Nunca el
 *   cliente, ni con los gastos abiertos.
 *
 * Si alguna vez una ruta de gastos queda con `payment.read`, el cliente puede
 * calcular tu margen con un `curl`.
 */
export const financeRouter = Router({ mergeParams: true });

financeRouter.use(isAuthenticated, requireProjectAccess);

// ── Cobros: el cliente los ve (si la obra no se los cierra) ───────────────────────────────────────────────
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

// ── Gastos: el cliente sólo si la obra se los abre ────────────────────────────────────────────
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

// El resumen con margen y la nómina van con su propia capacidad, nunca con
// `payment.read` ni con `expense.read`: el cliente con los gastos abiertos ve la
// lista, no la utilidad calculada ni los jornales.
financeRouter.get('/summary', requireCapability('finance.summary.read'), getFinanceSummary);
financeRouter.get('/payroll', requireCapability('finance.summary.read'), getPayroll);

export default financeRouter;
