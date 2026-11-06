import {
  DEPOSIT_MOVEMENT_KINDS,
  depositLineKey,
  summarizeDeposit,
  type DepositLedgerEntry,
  type DepositLine,
  type ImportFromDepositInput,
  type SendToDepositInput,
} from '@luma/shared';
import mongoose from 'mongoose';
import { Expense } from '../models/Expense.js';
import type { IProject } from '../models/Project.js';
import { StockMovement, type IStockMovement } from '../models/StockMovement.js';
import { conflict, notFound } from '../utils/errors.js';
import { currentStock } from './inventory.service.js';

/** La obra del otro lado de una fila del Depósito: la que mandó (ingreso) o la que recibió (egreso). */
export function movementProjectId(
  movement: Pick<IStockMovement, 'originProject' | 'destinationProject'>,
): string | null {
  const id = movement.originProject ?? movement.destinationProject;
  return id ? String(id) : null;
}

/**
 * Cotización con que se congela el costo de referencia: el costo va en la moneda
 * de la obra de origen y no se convierte, así que es 1. Se guarda igual en cada
 * fila del Depósito para que la regla («moneda y cotización, congeladas») valga
 * sin excepciones el día que haya que convertir.
 */
export const DEPOSIT_COST_RATE = 1;

/** Lo que se lee de una fila del Depósito para sumarla: el resto no hace falta. */
export type DepositRow = Pick<
  IStockMovement,
  | 'itemKey'
  | 'name'
  | 'unit'
  | 'kind'
  | 'quantity'
  | 'unitCost'
  | 'currency'
  | 'originProject'
  | 'destinationProject'
  | 'occurredAt'
>;

const LEDGER_FIELDS =
  'itemKey name unit kind quantity unitCost currency originProject destinationProject occurredAt';

/** Lo que `summarizeDeposit` necesita de una fila del Depósito. */
export function toDepositEntry(movement: DepositRow): DepositLedgerEntry {
  return {
    itemKey: movement.itemKey,
    name: movement.name,
    unit: movement.unit,
    kind: movement.kind as DepositLedgerEntry['kind'],
    quantity: movement.quantity,
    unitCost: movement.unitCost ?? 0,
    currency: movement.currency ?? '',
    projectId: movementProjectId(movement),
    occurredAt: movement.occurredAt.toISOString(),
  };
}

/**
 * El kardex del Depósito de una Empresa, en orden de fecha, sólo con los campos
 * que se suman. Las líneas y el ahorro necesitan todas las filas (el costo es un
 * promedio móvil que depende de lo que pasó antes), así que ésta es la lectura
 * completa: va sin hidratar y sin los campos que no se usan. Si el historial
 * llega a pesar, el paso siguiente es guardar un resumen, no leer menos.
 */
export async function depositLedger(organization: unknown): Promise<DepositRow[]> {
  return StockMovement.find({ organization, kind: { $in: DEPOSIT_MOVEMENT_KINDS } })
    .select(LEDGER_FIELDS)
    .sort({ occurredAt: 1, _id: 1 })
    .lean<DepositRow[]>();
}

/** Las últimas filas del Depósito, más nuevas primero: ordena y acota la base, no Node. */
export async function depositHistory(organization: unknown, limit: number): Promise<IStockMovement[]> {
  return StockMovement.find({ organization, kind: { $in: DEPOSIT_MOVEMENT_KINDS } })
    .sort({ occurredAt: -1, _id: -1 })
    .limit(limit);
}

/** Lo que hay hoy en el Depósito, recalculado. */
export async function depositLines(organization: unknown): Promise<DepositLine[]> {
  const ledger = await depositLedger(organization);
  return summarizeDeposit(ledger.map(toDepositEntry));
}

/**
 * Deshace las filas de un traspaso que falló a medias. Es limpieza: si el borrado
 * también falla se avisa en el log y **no** se lanza, para que el error que ve
 * quien llama sea el original y no el de la limpieza. Lo que quede suelto lo
 * repara `repairIncompleteTransfers`.
 */
async function rollbackTransfer(transfer: mongoose.Types.ObjectId): Promise<void> {
  try {
    await StockMovement.deleteMany({ transfer });
  } catch (error) {
    console.error('❌ [DEPOSIT] no se pudo deshacer el traspaso', String(transfer), error);
  }
}

interface Actor {
  project: IProject;
  userId: string;
}

/**
 * Manda material de la obra al Depósito General: sale del patio y entra a la
 * Empresa, con su costo de referencia congelado.
 *
 * Son dos filas y no hay transacciones: si la segunda falla se borra la
 * primera, que es de este mismo request, para no dejar material "en tránsito"
 * que no está en ningún lado.
 */
export async function sendToDeposit(
  { project, userId }: Actor,
  { itemKey, quantity, unitCost, note }: SendToDepositInput,
): Promise<IStockMovement> {
  const item = (await currentStock(project._id)).find((candidate) => candidate.itemKey === itemKey);
  if (!item) throw notFound('Ese material no está en el inventario de esta obra.');
  if (quantity > item.stock) {
    throw conflict(`Solo quedan ${item.stock} ${item.unit} de ${item.name} en la obra.`, {
      available: item.stock,
    });
  }

  const transfer = new mongoose.Types.ObjectId();
  const shared = {
    transfer,
    organization: project.organization,
    itemKey,
    name: item.name,
    unit: item.unit,
    quantity,
    note,
    occurredAt: new Date(),
    createdBy: userId,
  };

  const fromProject = await StockMovement.create({
    ...shared,
    project: project._id,
    kind: 'desincorporacion',
  });
  try {
    await StockMovement.create({
      ...shared,
      kind: 'deposito_ingreso',
      originProject: project._id,
      unitCost,
      currency: project.currency,
      exchangeRate: DEPOSIT_COST_RATE,
    });
  } catch (error) {
    await rollbackTransfer(transfer);
    throw error;
  }
  return fromProject;
}

/**
 * Hoy como `YYYY-MM-DD` en hora del servidor, el formato en que `Expense.spentOn`
 * guarda un día. `toISOString()` daría el día siguiente a la noche en UTC−4.
 */
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Trae material del Depósito a esta obra, a costo $0: no hay factura, ni
 * proveedor, ni cuenta por pagar. Cada egreso congela el costo promedio del
 * momento, que es lo que después cuenta como ahorro.
 *
 * El flete, si lo hubo, es un gasto común de esta obra (`Expense`, categoría
 * «otro», en su moneda). Todo es del mismo traspaso: si algo falla se deshace
 * lo escrito, y el gasto va al final para que no quede uno huérfano.
 */
export async function importFromDeposit(
  { project, userId }: Actor,
  { lines, freight }: ImportFromDepositInput,
): Promise<IStockMovement[]> {
  const available = new Map((await depositLines(project.organization)).map((line) => [line.lineKey, line]));

  const picked = lines.map((requested) => {
    const line = available.get(depositLineKey(requested.itemKey, requested.currency));
    if (!line || line.stock <= 0) throw notFound('Ese material ya no está en el Depósito.');
    if (requested.quantity > line.stock) {
      throw conflict(`Solo quedan ${line.stock} ${line.unit} de ${line.name} en el Depósito.`, {
        available: line.stock,
      });
    }
    return { line, quantity: requested.quantity };
  });

  const transfer = new mongoose.Types.ObjectId();
  const occurredAt = new Date();
  const fieldsOf = (line: DepositLine, quantity: number) => ({
    transfer,
    organization: project.organization,
    itemKey: line.itemKey,
    name: line.name,
    unit: line.unit,
    quantity,
    occurredAt,
    createdBy: userId,
  });

  try {
    await StockMovement.insertMany(
      picked.map(({ line, quantity }) => ({
        ...fieldsOf(line, quantity),
        kind: 'deposito_egreso',
        destinationProject: project._id,
        unitCost: line.unitCost,
        currency: line.currency,
        exchangeRate: DEPOSIT_COST_RATE,
      })),
    );
    const imported = await StockMovement.insertMany(
      picked.map(({ line, quantity }) => ({
        ...fieldsOf(line, quantity),
        project: project._id,
        kind: 'importacion',
      })),
    );
    if (freight) {
      await Expense.create({
        project: project._id,
        category: 'otro',
        description: freight.description || 'Flete de traslado desde el Depósito General',
        amount: freight.amount,
        currency: project.currency,
        exchangeRate: 1,
        spentOn: today(),
        registeredBy: userId,
      });
    }
    return imported as unknown as IStockMovement[];
  } catch (error) {
    await rollbackTransfer(transfer);
    throw error;
  }
}

/** Un traspaso más nuevo que esto puede estar escribiéndose todavía: no se toca. */
export const TRANSFER_REPAIR_MIN_AGE_MS = 10 * 60 * 1000;
/**
 * Más viejo que esto ya no se mira. El tope no es por costo: una obra purgada se
 * lleva sus filas `importacion` (90 días después de eliminarse), y esa ausencia
 * se parecería a un traspaso roto. Con tres días de ventana y una corrida
 * diaria, un corte se repara sin que la purga pueda confundirse con uno.
 */
export const TRANSFER_REPAIR_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Un traspaso son dos filas (la de la obra y la del Depósito) y no hay
 * transacciones: un corte del proceso entre las dos escrituras deja material «en
 * tránsito». Esto revierte los traspasos con una mitad faltante —el stock vuelve
 * a donde estaba y la persona repite la acción— dentro de la ventana segura.
 * Idempotente: un traspaso completo no se toca.
 */
export async function repairIncompleteTransfers(
  now: Date = new Date(),
): Promise<{ checked: number; repaired: number }> {
  const count = (kind: string) => ({ $sum: { $cond: [{ $eq: ['$kind', kind] }, 1, 0] } });
  const groups = await StockMovement.aggregate<{
    _id: unknown;
    sent: number;
    deposited: number;
    exported: number;
    imported: number;
  }>([
    {
      $match: {
        transfer: { $exists: true },
        createdAt: {
          $gte: new Date(now.getTime() - TRANSFER_REPAIR_MAX_AGE_MS),
          $lte: new Date(now.getTime() - TRANSFER_REPAIR_MIN_AGE_MS),
        },
      },
    },
    {
      $group: {
        _id: '$transfer',
        sent: count('desincorporacion'),
        deposited: count('deposito_ingreso'),
        exported: count('deposito_egreso'),
        imported: count('importacion'),
      },
    },
  ]);

  const broken = groups.filter(
    (group) => group.sent !== group.deposited || group.exported !== group.imported,
  );
  if (broken.length > 0) {
    await StockMovement.deleteMany({ transfer: { $in: broken.map((group) => group._id) } });
  }
  return { checked: groups.length, repaired: broken.length };
}
