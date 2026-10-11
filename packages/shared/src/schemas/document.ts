import { z } from 'zod';

/**
 * Schemas de la documentación de obra. Sin imports de `./index.ts`, mismo
 * criterio que `./project.ts`: evita depender del orden de evaluación de un
 * barrel que se re-exporta a sí mismo.
 */

export const documentCategorySchema = z.enum([
  'condiciones_sitio',
  'horario_trabajo',
  'permiso_edificio',
  'permiso_municipal',
  'plano',
  'render',
  'otra',
]);

const titleSchema = z
  .string()
  .trim()
  .min(1, 'El título es obligatorio')
  .max(160, 'El título es demasiado largo');

const spaceSchema = z.string().trim().max(120, 'El espacio es demasiado largo');

const notesSchema = z.string().trim().max(2000, 'Las notas son demasiado largas');

/**
 * Los metadatos que acompañan al archivo. Viajan como campos de texto de un
 * multipart, así que todo llega string — de ahí que no haya ningún número ni
 * booleano acá.
 */
export const createProjectDocumentSchema = z
  .object({
    category: documentCategorySchema,
    title: titleSchema,
    space: spaceSchema.optional(),
    notes: notesSchema.optional(),
  })
  .transform((data) => ({
    ...data,
    // Un `space` vacío es "no lo puso", no un espacio llamado "". Normalizarlo
    // acá evita que la lista agrupe por una cadena vacía más adelante.
    space: data.space || undefined,
    notes: data.notes || undefined,
  }));

/**
 * Editar sólo la ficha, nunca el archivo: reemplazar el contenido de un plano
 * manteniendo su id borraría la versión anterior sin dejar rastro, y "cargar
 * actualización de planos" (la fila del gerente en la matriz) es justamente
 * un documento nuevo que convive con el viejo.
 */
export const updateProjectDocumentSchema = z
  .object({
    category: documentCategorySchema.optional(),
    title: titleSchema.optional(),
    space: spaceSchema.optional(),
    notes: notesSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'No hay nada para actualizar',
  });

export type DocumentCategoryInput = z.infer<typeof documentCategorySchema>;
export type CreateProjectDocumentInput = z.infer<typeof createProjectDocumentSchema>;
export type UpdateProjectDocumentInput = z.infer<typeof updateProjectDocumentSchema>;
