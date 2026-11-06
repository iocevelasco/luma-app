import {
  createStockMovementSchema,
  stockMovementQuerySchema,
  type StockMovement as StockMovementDTO,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import type { IProject } from '../models/Project.js';
import { StockMovement, type IStockMovement } from '../models/StockMovement.js';
import { currentStock, ensurePurchaseEntries } from '../services/inventory.service.js';
import { badRequest, conflict, notFound, unauthenticated, wrapAsync as wrap } from '../utils/errors.js';

/** Los 1000 más recientes: un kardex que los pasa se acota con los filtros. */
const MOVEMENTS_LIMIT = 1000;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Populated = Omit<IStockMovement, 'activity' | 'createdBy'> & {
  activity?: { _id: unknown; name: string } | null;
  createdBy: { _id: unknown; name?: string } | unknown;
};

function toMovementDTO(movement: Populated): StockMovementDTO {
  const activity = movement.activity;
  const creator = movement.createdBy as { _id?: unknown; name?: string } | undefined;
  const populatedCreator = creator && typeof creator === 'object' && '_id' in creator;
  return {
    id: String(movement._id),
    projectId: String(movement.project),
    itemKey: movement.itemKey,
    name: movement.name,
    unit: movement.unit,
    kind: movement.kind,
    quantity: movement.quantity,
    activityId: activity ? String(activity._id ?? activity) : null,
    activityName: activity && typeof activity === 'object' ? activity.name : undefined,
    destination: movement.destination,
    receiver: movement.receiver,
    reason: movement.reason,
    note: movement.note,
    materialId: movement.material ? String(movement.material) : null,
    occurredAt: movement.occurredAt.toISOString(),
    createdBy: String(populatedCreator ? creator._id : movement.createdBy),
    createdByName: populatedCreator ? creator.name : undefined,
    createdAt: movement.createdAt.toISOString(),
  };
}

/** Requiere `requireProjectAccess` + `requireCapability('inventory.read')`. */
export const listStock = wrap(async (req, res) => {
  const project = req.project as IProject;
  return res.json({ success: true, data: { items: await currentStock(project._id) } });
});

/** Requiere `requireProjectAccess` + `requireCapability('inventory.read')`. */
export const listMovements = wrap(async (req, res) => {
  const parsed = stockMovementQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const { from, to, itemKey, receiver, kind } = parsed.data;
  await ensurePurchaseEntries(project._id);

  const occurredAt: Record<string, Date> = {};
  if (from) occurredAt.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) occurredAt.$lte = new Date(`${to}T23:59:59.999Z`);

  const movements = await StockMovement.find({
    project: project._id,
    ...(Object.keys(occurredAt).length > 0 ? { occurredAt } : {}),
    ...(itemKey ? { itemKey } : {}),
    ...(kind ? { kind } : {}),
    ...(receiver ? { receiver: new RegExp(escapeRegex(receiver), 'i') } : {}),
  })
    .populate('activity', 'name')
    .populate('createdBy', 'name')
    .sort({ occurredAt: -1, createdAt: -1 })
    .limit(MOVEMENTS_LIMIT);

  return res.json({
    success: true,
    data: { movements: movements.map((movement) => toMovementDTO(movement as unknown as Populated)) },
  });
});

/**
 * Requiere `requireProjectAccess` + `requireCapability('inventory.write')`.
 *
 * Sólo se registran devoluciones, consumos y mermas de un material que ya
 * entró: el material se elige de lo que hay en el patio, no se inventa acá. Una
 * salida que dejaría el stock en negativo se frena: el kardex no puede decir
 * que se sacó lo que nunca estuvo.
 */
export const createMovement = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const parsed = createStockMovementSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const { kind, itemKey, quantity, activityId, ...rest } = parsed.data;

  if (activityId && !(await Activity.findOne({ _id: activityId, project: project._id }))) {
    throw badRequest('La tarea no pertenece a esta obra');
  }

  const stock = await currentStock(project._id);
  const item = stock.find((candidate) => candidate.itemKey === itemKey);
  if (!item) throw notFound('Ese material no está en el inventario de esta obra.');

  if (kind !== 'devolucion' && quantity > item.stock) {
    throw conflict(`Solo quedan ${item.stock} ${item.unit} de ${item.name} en la obra.`, {
      available: item.stock,
    });
  }

  const created = await StockMovement.create({
    ...rest,
    project: project._id,
    itemKey,
    name: item.name,
    unit: item.unit,
    kind,
    quantity,
    activity: activityId || null,
    // Siempre ahora, del servidor: el kardex es historia y una fecha elegida por quien
    // lo carga permitiría meter un movimiento en un período ya cerrado.
    occurredAt: new Date(),
    createdBy: req.user.sub,
  });

  return res
    .status(201)
    .json({ success: true, data: { movement: toMovementDTO(created as unknown as Populated) } });
});
