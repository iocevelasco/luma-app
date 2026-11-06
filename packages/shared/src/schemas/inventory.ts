import { z } from 'zod';
import { MANUAL_STOCK_MOVEMENT_KINDS, STOCK_MOVEMENT_KINDS } from '../types/inventory.js';

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

/** Filtros del kardex. Llegan por query string, así que todo es texto. */
export const stockMovementQuerySchema = z.object({
  /** `YYYY-MM-DD`, inclusive. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  itemKey: z.string().trim().min(1).max(160).optional(),
  receiver: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(STOCK_MOVEMENT_KINDS).optional(),
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>;
