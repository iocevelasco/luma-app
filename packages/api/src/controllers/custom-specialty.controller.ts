import { createCustomSpecialtySchema, updateCustomSpecialtySchema } from '@luma/shared';
import type { Request, Response } from 'express';
import type { IProject } from '../models/Project.js';
import { addCustomSpecialty, updateCustomSpecialty } from '../services/custom-specialty.service.js';
import { badRequest, notFound } from '../utils/errors.js';

/**
 * Especialidades propias de la obra. Requiere `requireProjectAccess` y la
 * capacidad `specialty.manage` que declara el router.
 */
export async function createProjectSpecialty(req: Request, res: Response) {
  const parsed = createCustomSpecialtySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const specialty = await addCustomSpecialty(req.project as IProject, parsed.data.label);
  return res.status(201).json({ success: true, data: { specialty } });
}

export async function updateProjectSpecialty(req: Request, res: Response) {
  const parsed = updateCustomSpecialtySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const specialty = await updateCustomSpecialty(
    req.project as IProject,
    String(req.params.key),
    parsed.data,
  );
  if (!specialty) throw notFound('No encontramos esa especialidad.');
  return res.json({ success: true, data: { specialty } });
}
