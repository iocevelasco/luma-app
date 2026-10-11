import type mongoose from 'mongoose';
import { roundMoney, type PayrollLine, type PayrollSummary } from '@luma/shared';
import { CrewMember } from '../models/CrewMember.js';
import { LaborRecord } from '../models/LaborRecord.js';

/**
 * Nómina **calculada**, no cargada: quién vino, cuántos días, a cuánto el
 * jornal.
 *
 * Se deriva de los `LaborRecord` que el supervisor ya carga todos los días
 * cruzados con `CrewMember.dailyRate`. Esa es la única forma de que "gasto de
 * nómina" sea un número que cierre con la asistencia; un monto escrito a mano
 * puede decir cualquier cosa.
 *
 * El resultado no se guarda: el gerente lo mira y, si está de acuerdo, lo
 * registra como un `Expense` de categoría `nomina`. Guardar el cálculo haría
 * que cambie solo cuando alguien corrige una asistencia vieja.
 */

/**
 * Una persona cuenta **un día por fecha**, aunque haya estado en tres
 * actividades distintas.
 *
 * El parte diario es por actividad, así que alguien que pasó por la cocina y
 * por el baño el mismo martes aparece en dos `LaborRecord`. Contarlo dos veces
 * le pagaría el doble.
 */
export async function payrollFor(
  projectId: mongoose.Types.ObjectId | string,
  from: string,
  to: string,
  currency: string,
): Promise<PayrollSummary> {
  const records = await LaborRecord.find({
    project: projectId,
    date: { $gte: from, $lte: to },
  }).select('date presentCrewMembers');

  // `${personaId}|${fecha}` — el Set colapsa el mismo día en dos actividades.
  const presence = new Set<string>();
  for (const record of records) {
    for (const memberId of record.presentCrewMembers) {
      presence.add(`${String(memberId)}|${record.date}`);
    }
  }

  const daysByMember = new Map<string, number>();
  for (const key of presence) {
    const memberId = key.split('|')[0];
    daysByMember.set(memberId, (daysByMember.get(memberId) ?? 0) + 1);
  }

  const members = await CrewMember.find({ _id: { $in: [...daysByMember.keys()] } }).select(
    'name dailyRate',
  );

  const lines: PayrollLine[] = [];
  let missingRateCount = 0;

  for (const member of members) {
    const daysPresent = daysByMember.get(String(member._id)) ?? 0;
    const dailyRate = member.dailyRate;

    if (dailyRate === undefined || dailyRate === null) {
      // Sin jornal no se inventa un cero: un cero diría que esa persona
      // trabaja gratis y el total parecería completo cuando no lo está.
      missingRateCount += 1;
      continue;
    }

    lines.push({
      crewMemberId: String(member._id),
      name: member.name,
      daysPresent,
      dailyRate,
      total: roundMoney(daysPresent * dailyRate),
    });
  }

  lines.sort((a, b) => b.total - a.total);

  return {
    from,
    to,
    currency,
    lines,
    total: roundMoney(lines.reduce((sum, line) => sum + line.total, 0)),
    missingRateCount,
  };
}
