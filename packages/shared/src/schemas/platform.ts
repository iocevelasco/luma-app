import { z } from 'zod';
import { ACCOUNT_SEGMENTS } from '../platform-accounts/index.js';

/**
 * Schemas del panel de plataforma. Sin imports de `./index.ts`, mismo criterio
 * que `./project.ts`.
 */

export const PLATFORM_USERS_FILTERS = ['all', 'active', 'unverified', 'inactive'] as const;

/** Qué subconjunto de cuentas lista la pantalla. */
export const platformUsersFilterSchema = z.enum(PLATFORM_USERS_FILTERS);

/** `all` no filtra; el resto es un segmento de `ACCOUNT_SEGMENTS`. */
export const PLATFORM_USERS_SEGMENTS = ['all', ...ACCOUNT_SEGMENTS] as const;

export const platformUsersSegmentSchema = z.enum(PLATFORM_USERS_SEGMENTS);

export const platformUsersQuerySchema = z.object({
  filter: platformUsersFilterSchema.default('all'),
  segment: platformUsersSegmentSchema.default('all'),
  /** Busca en nombre y mail. */
  q: z.string().trim().max(80).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const PLATFORM_FOLLOW_UP_FILTERS = ['all', 'risk', 'trial', 'paying', 'expired'] as const;

export const platformFollowUpQuerySchema = z.object({
  filter: z.enum(PLATFORM_FOLLOW_UP_FILTERS).default('all'),
  /** Busca en nombre y mail. */
  q: z.string().trim().max(80).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PlatformFollowUpQuery = z.infer<typeof platformFollowUpQuerySchema>;
export type PlatformUsersFilter = z.infer<typeof platformUsersFilterSchema>;
export type PlatformUsersSegment = z.infer<typeof platformUsersSegmentSchema>;
export type PlatformUsersQuery = z.infer<typeof platformUsersQuerySchema>;

/** Asignar o quitar el plan ilimitado. Sólo lo manda el admin de la plataforma. */
export const setUnlimitedPlanSchema = z.object({
  unlimited: z.boolean(),
});

export type SetUnlimitedPlanInput = z.infer<typeof setUnlimitedPlanSchema>;
