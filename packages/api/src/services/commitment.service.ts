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
 * **Comprometido no es gastado.** La regla 8 del documento funcional decía
 * que la app no registraba pagos; eso dejó de valer cuando entró el módulo de
 * cobros y gastos (`finance.service.ts`), pero la distinción que la regla
 * protegía sigue en pie y ahora importa más, porque hay tres cifras parecidas
 * conviviendo:
 *
 * - **Comprometido** (acá): lo cotizado en contrataciones aprobadas. Plata que
 *   ya tiene dueño pero que todavía no salió.
 * - **Gastado** (`Expense`): lo que efectivamente salió, con fecha y
 *   comprobante.
 * - **Presupuestado** (`Budget`): lo que se planeó gastar.
 *
 * Un adelanto a un proveedor aparece en las dos primeras y **no se suma**: el
 * compromiso es el total de la contratación, el gasto es lo que se pagó de
 * ella. Sumarlas contaría la misma plata dos veces. Si alguna vez hace falta
 * "comprometido pendiente de pago", es una resta entre las dos, no un campo
 * nuevo.
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
