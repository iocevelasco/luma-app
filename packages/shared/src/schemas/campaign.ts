import { z } from 'zod';

/** Sin imports de `./index.ts`, mismo criterio que `./project.ts`. */

export const CAMPAIGN_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Los formatos que todos los clientes de correo muestran (WebP no, en varios). */
export const CAMPAIGN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;

export const campaignInputSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120, 'El título es demasiado largo'),
  body: z
    .string()
    .trim()
    .min(1, 'El contenido es obligatorio')
    .max(5000, 'El contenido es demasiado largo'),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
