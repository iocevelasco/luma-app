import type mongoose from 'mongoose';
import { roundMoney } from '@luma/shared';
import { ProviderEngagement } from '../models/ProviderEngagement.js';

/**
 * Plata de la obra que ya tiene dueño: lo cotizado en contrataciones
 * APROBADAS.
 *
 * Vive en un servicio y no en un controller porque lo necesitan dos lugares
 * —la tarjeta de presupuesto y el Consultor IA— y con dos copias una se
 * desactualiza. Es justo lo que pasó antes: el Consultor calculaba
 * "comprometido" como la suma de las líneas del presupuesto, que está
 * validada para ser IGUAL al total, así que siempre informaba 100%.
 *
 * Es compromiso en el sentido del documento funcional, no contabilidad: acá
 * no se registran pagos ni cuentas por pagar (regla 8).
 */
export async function committedForProject(
  projectId: mongoose.Types.ObjectId | string,
): Promise<number> {
  const approved = await ProviderEngagement.find({
    project: projectId,
    status: 'aprobada',
  }).select('quotedAmount');

  return roundMoney(
    approved.reduce((sum, engagement) => sum + (engagement.quotedAmount ?? 0), 0),
  );
}
