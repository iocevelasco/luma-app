import type { ProviderSpecialty } from '@luma/shared';
import {
  AirVent,
  BrickWall,
  Building2,
  Cog,
  Droplets,
  FireExtinguisher,
  Flame,
  Grid3x3,
  Hammer,
  Network,
  Paintbrush,
  Pickaxe,
  Sparkles,
  Store,
  Trees,
  Umbrella,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Un ícono por rubro de obra. En una lista de proveedores el ícono se lee
 * antes que el texto: sirve para encontrar al electricista de un vistazo sin
 * leer la columna de especialidad.
 *
 * Está completo por tipo: si mañana se agrega un rubro al enum, TypeScript
 * exige el ícono acá y no hay forma de que quede uno sin dibujo.
 */
export const SPECIALTY_ICONS: Record<ProviderSpecialty, LucideIcon> = {
  electricidad: Zap,
  plomeria: Droplets,
  gas: Flame,
  carpinteria: Hammer,
  cristaleria: Grid3x3,
  albanileria: BrickWall,
  herreria: Wrench,
  redes: Network,
  mecanicas: Cog,
  estructura: Building2,
  acabados: Sparkles,
  pintura: Paintbrush,
  climatizacion: AirVent,
  fire_protection: FireExtinguisher,
  techos: Umbrella,
  pisos_revestimientos: Grid3x3,
  jardineria: Trees,
  demolicion: Pickaxe,
  materiales: Store,
  otra: Wind,
};

export function iconForSpecialty(specialty: ProviderSpecialty | undefined): LucideIcon {
  return specialty ? SPECIALTY_ICONS[specialty] : Wrench;
}
