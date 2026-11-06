import { z } from 'zod';
import { MANUAL_STOCK_MOVEMENT_KINDS, PROJECT_STOCK_MOVEMENT_KINDS } from '../types/inventory.js';

/**
 * Schemas del inventario de obra. `compra` no está: la genera el sistema
 * cuando un material llega a obra, nadie la carga a mano. Que el material
 * exista y que haya stock para sacar necesita ir a la base: lo valida el
 * controller, no este schema.
 */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Identificador inválido');

export const manualStockMovementKindSchema = z.enum(MANUAL_STOCK_MOVEMENT_KINDS);

export const createStockMovementSchema = z
  .object({
    kind: manualStockMovementKindSchema,
    itemKey: z.string().trim().min(1, 'Elige un material').max(160),
    quantity: z
      .number({ invalid_type_error: 'La cantidad es obligatoria' })
      .positive('Tiene que ser mayor a 0'),
    activityId: objectIdSchema.optional().nullable(),
    destination: z.string().trim().max(120, 'Es demasiado largo').optional(),
    receiver: z.string().trim().max(120, 'Es demasiado largo').optional(),
    reason: z.string().trim().max(200, 'Es demasiado largo').optional(),
    note: z.string().trim().max(500, 'Es demasiado largo').optional(),
  })
  .superRefine((value, ctx) => {
    // Quien se lleva el material y por qué se perdió es lo que hace útil al
    // kardex: sin eso una merma camufla la pérdida que debía mostrar.
    if (value.kind !== 'devolucion' && !value.receiver) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receiver'],
        message: value.kind === 'merma' ? 'Indica el responsable' : 'Indica quién lo recibe',
      });
    }
    if (value.kind === 'merma' && !value.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Indica el motivo',
      });
    }
  });

/**
 * Mandar material de la obra al Depósito General. El costo es de referencia
 * —lo que valía una unidad—: lo precarga la pantalla con el costo estimado del
 * material y la persona lo confirma. Sin costo (0) el material viaja igual y
 * no cuenta para el ahorro. Va en la moneda de la obra de origen.
 */
export const sendToDepositSchema = z.object({
  itemKey: z.string().trim().min(1, 'Elige un material').max(160),
  quantity: z
    .number({ invalid_type_error: 'La cantidad es obligatoria' })
    .positive('Tiene que ser mayor a 0'),
  unitCost: z.number({ invalid_type_error: 'El costo es obligatorio' }).min(0, 'No puede ser negativo').default(0),
  note: z.string().trim().max(500, 'Es demasiado largo').optional(),
});

/**
 * Traer material del Depósito a esta obra, a costo $0. El flete, si lo hubo, se
 * imputa como un gasto de esta obra, en su moneda.
 */
export const importFromDepositSchema = z
  .object({
    lines: z
      .array(
        z.object({
          itemKey: z.string().trim().min(1).max(160),
          currency: z.string().trim().min(1).max(10),
          quantity: z.number().positive('Tiene que ser mayor a 0'),
        }),
      )
      .min(1, 'Elige al menos un material')
      .max(50),
    freight: z
      .object({
        amount: z.number().positive('Tiene que ser mayor a 0'),
        description: z.string().trim().max(200, 'Es demasiado largo').optional(),
      })
      .optional(),
  })
  .refine(
    (value) =>
      new Set(value.lines.map((line) => `${line.itemKey}|${line.currency}`)).size ===
      value.lines.length,
    { message: 'Un material no puede repetirse', path: ['lines'] },
  );

/** Filtros del kardex. Llegan por query string, así que todo es texto. */
export const stockMovementQuerySchema = z.object({
  /** `YYYY-MM-DD`, inclusive. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  itemKey: z.string().trim().min(1).max(160).optional(),
  receiver: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(PROJECT_STOCK_MOVEMENT_KINDS).optional(),
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type SendToDepositInput = z.infer<typeof sendToDepositSchema>;
export type ImportFromDepositInput = z.infer<typeof importFromDepositSchema>;
export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>;
