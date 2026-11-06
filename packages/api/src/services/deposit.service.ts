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
export function movementProjectId(movement: IStockMovement): string | null {
  const id = movement.originProject ?? movement.destinationProject;
  return id ? String(id) : null;
}

/** Lo que `summarizeDeposit` necesita de una fila del Depósito. */
export function toDepositEntry(movement: IStockMovement): DepositLedgerEntry {
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

/** Todo el kardex del Depósito de una Empresa. */
export async function depositLedger(organization: unknown): Promise<IStockMovement[]> {
  return StockMovement.find({ organization, kind: { $in: DEPOSIT_MOVEMENT_KINDS } });
}

/** Lo que hay hoy en el Depósito, recalculado. */
export async function depositLines(organization: unknown): Promise<DepositLine[]> {
  const ledger = await depositLedger(organization);
  return summarizeDeposit(ledger.map(toDepositEntry));
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
    });
  } catch (error) {
    await StockMovement.deleteMany({ transfer });
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
    await StockMovement.deleteMany({ transfer });
    throw error;
  }
}
