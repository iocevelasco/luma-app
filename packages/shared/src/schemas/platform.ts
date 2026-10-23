import { z } from 'zod';

/**
 * Schemas del panel de plataforma. Sin imports de `./index.ts`, mismo criterio
 * que `./project.ts`.
 */

export const PLATFORM_USERS_FILTERS = ['all', 'active', 'unverified', 'inactive'] as const;

/** Qué subconjunto de cuentas lista la pantalla. */
export const platformUsersFilterSchema = z.enum(PLATFORM_USERS_FILTERS);

export const platformUsersQuerySchema = z.object({
  filter: platformUsersFilterSchema.default('all'),
  /** Busca en nombre y mail. */
  q: z.string().trim().max(80).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PlatformUsersFilter = z.infer<typeof platformUsersFilterSchema>;
export type PlatformUsersQuery = z.infer<typeof platformUsersQuerySchema>;
