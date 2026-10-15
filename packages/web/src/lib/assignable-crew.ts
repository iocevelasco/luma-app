import type { CrewMember } from '@luma/shared';

/**
 * Quién puede quedar a cargo de una tarea. Una sola regla para el Tablero y
 * el Cronograma: cuando cada pantalla tenía la suya, una persona se podía
 * elegir en una y no en la otra, y nadie entendía por qué.
 *
 * Un "Equipo" (una cuadrilla contratada, una máquina con operador) SÍ puede
 * responder por una tarea: así lo usa quien carga el Tablero. Sólo queda
 * afuera quien está dado de baja.
 */
export function isAssignableCrew(member: Pick<CrewMember, 'active'>): boolean {
  return member.active;
}

/** El equipo lleva el sufijo para distinguirlo de una persona homónima. */
export function crewOptionLabel(
  member: Pick<CrewMember, 'name' | 'kind'>,
  equipoLabel: string,
): string {
  return member.kind === 'equipo' ? `${member.name} · ${equipoLabel}` : member.name;
}
