import type { ActivityStatus, ProviderSpecialty } from '@luma/shared';

/** Los estados de una actividad, en el orden en que se ofrecen. */
export const ACTIVITY_STATUSES: readonly ActivityStatus[] = [
  'pendiente',
  'en_curso',
  'en_revision',
  'completada',
  'cancelada',
] as const;

/** Mismo catálogo que proveedores y personal (test de sincronía en `@luma/shared`). */
export const ACTIVITY_SPECIALTIES: readonly ProviderSpecialty[] = [
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'cristaleria',
  'albanileria',
  'herreria',
  'redes',
  'mecanicas',
  'estructura',
  'acabados',
  'pintura',
  'climatizacion',
  'techos',
  'pisos_revestimientos',
  'jardineria',
  'demolicion',
  'otra',
];

/** Un material en estos estados todavía no llegó a la obra: bloquea a su actividad. */
export const MATERIAL_STATUSES_BLOCKING: ReadonlySet<string> = new Set(['pendiente', 'solicitado']);
