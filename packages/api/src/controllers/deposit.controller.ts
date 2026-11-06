import {
  importFromDepositSchema,
  sendToDepositSchema,
  summarizeDeposit,
  summarizeSavings,
  type DepositMovement as DepositMovementDTO,
  type SavingsLine,
  type StockMovement as StockMovementDTO,
} from '@luma/shared';
import { Project, type IProject } from '../models/Project.js';
import type { IStockMovement } from '../models/StockMovement.js';
import {
  depositHistory,
  depositLedger,
  depositLines,
  importFromDeposit,
  movementProjectId,
  sendToDeposit,
  toDepositEntry,
} from '../services/deposit.service.js';
import { findMyOrganizationId } from '../services/organization.service.js';
import { badRequest, forbidden, notFound, unauthenticated, wrapAsync as wrap } from '../utils/errors.js';

/** Los 200 más recientes del historial del Depósito. */
const HISTORY_LIMIT = 200;

/** El movimiento de la obra tal como lo ve su kardex (sin populate: quien lo acaba de crear lo conoce). */
function toObraMovementDTO(movement: IStockMovement): StockMovementDTO {
  return {
    id: String(movement._id),
    projectId: String(movement.project),
    itemKey: movement.itemKey,
    name: movement.name,
    unit: movement.unit,
    kind: movement.kind as StockMovementDTO['kind'],
    quantity: movement.quantity,
    activityId: null,
    destination: movement.destination,
    receiver: movement.receiver,
    reason: movement.reason,
    note: movement.note,
    materialId: null,
    occurredAt: movement.occurredAt.toISOString(),
    createdBy: String(movement.createdBy),
    createdAt: movement.createdAt.toISOString(),
  };
}

/** Nombres de obra por id. Una obra en la papelera no aparece: el historial la muestra sin nombre. */
async function projectNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const projects = await Project.find({ _id: { $in: unique } }).select('name');
  return new Map(projects.map((project) => [String(project._id), project.name]));
}

/** Requiere `requireProjectAccess` + `requireCapability('inventory.deposit.write')`. */
export const listDepositForImport = wrap(async (req, res) => {
  const project = req.project as IProject;
  const lines = (await depositLines(project.organization)).filter((line) => line.stock > 0);
  return res.json({ success: true, data: { lines } });
});

/** Requiere `requireProjectAccess` + `requireCapability('inventory.deposit.write')`. */
export const sendToDepositHandler = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();
  const parsed = sendToDepositSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const movement = await sendToDeposit(
    { project: req.project as IProject, userId: req.user.sub },
    parsed.data,
  );
  return res.status(201).json({ success: true, data: { movement: toObraMovementDTO(movement) } });
});

/**
 * Requiere `requireProjectAccess` + `requireCapability('inventory.deposit.write')`.
 * El flete es un gasto: además pide `expense.write`.
 */
export const importFromDepositHandler = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();
  const parsed = importFromDepositSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);
  if (parsed.data.freight && !req.can?.('expense.write')) {
    throw forbidden('Tu rol no puede cargar gastos, así que el flete no se imputa desde acá.');
  }

  const movements = await importFromDeposit(
    { project: req.project as IProject, userId: req.user.sub },
    parsed.data,
  );
  return res
    .status(201)
    .json({ success: true, data: { movements: movements.map(toObraMovementDTO) } });
});

/**
 * El Depósito General de la Empresa del usuario: lo que hay, el historial y el
 * ahorro por reutilización. `findMyOrganizationId` sólo resuelve la Empresa
 * donde la persona es dueña: un integrante no tiene Depósito acá.
 */
export const getMyDeposit = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();
  const organizationId = await findMyOrganizationId(req.user.sub);
  if (!organizationId) throw notFound('No tienes una empresa todavía.');

  const ledger = await depositLedger(organizationId);
  const entries = ledger.map(toDepositEntry);
  const savings = summarizeSavings(entries);
  const recent = await depositHistory(organizationId, HISTORY_LIMIT);

  const names = await projectNames([
    ...recent.map(movementProjectId),
    ...savings.map((line) => line.projectId),
  ]);

  const movements: DepositMovementDTO[] = recent.map((movement) => {
    const projectId = movementProjectId(movement);
    return {
      id: String(movement._id),
      kind: movement.kind as DepositMovementDTO['kind'],
      itemKey: movement.itemKey,
      name: movement.name,
      unit: movement.unit,
      quantity: movement.quantity,
      unitCost: movement.unitCost ?? 0,
      currency: movement.currency ?? '',
      projectId,
      projectName: projectId ? names.get(projectId) : undefined,
      occurredAt: movement.occurredAt.toISOString(),
      createdBy: String(movement.createdBy),
    };
  });

  const savingsWithNames: SavingsLine[] = savings.map((line) => ({
    ...line,
    projectName: line.projectId ? names.get(line.projectId) : undefined,
  }));

  return res.json({
    success: true,
    data: {
      lines: summarizeDeposit(entries),
      movements,
      savings: savingsWithNames,
    },
  });
});
