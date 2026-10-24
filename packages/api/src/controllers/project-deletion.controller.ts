import type { NextFunction, Request, Response } from 'express';
import { deleteProjectSchema } from '@luma/shared';
import type { IProject } from '../models/Project.js';
import {
  findRestorable,
  listTrash,
  moveToTrash,
  restoreFromTrash,
  summarizeDeletion,
} from '../services/project-deletion.service.js';
import { decideProjectCreation } from '../services/subscription.service.js';
import { syncStripeExtras } from '../services/stripe.service.js';
import { AppError, badRequest, notFound, unauthenticated } from '../utils/errors.js';
import { toProjectDTO } from './project.controller.js';

/** Lo que se le dice a quien intenta restaurar una obra y choca con la suscripción. */
const RESTORE_BLOCKED: Record<'SUBSCRIPTION_REQUIRED' | 'PAID_PLAN_REQUIRED', string> = {
  SUBSCRIPTION_REQUIRED: 'Tu suscripción venció. Renová el plan para restaurar la obra.',
  PAID_PLAN_REQUIRED:
    'En el mes gratis podés tener hasta 3 obras activas. Activá el plan para restaurar esta obra.',
};

/** El conteo de obras cambió: la cantidad de extras en Stripe se corrige sin frenar la respuesta. */
function resyncExtras(project: IProject) {
  syncStripeExtras(project.organization).catch((error) =>
    console.error('❌ [STRIPE] syncStripeExtras:', error),
  );
}

/**
 * Qué se va con la obra. Requiere `requireProjectAccess` +
 * `requireCapability('project.delete')`. Es una lectura aparte y no parte del
 * DELETE para que la pantalla pueda mostrarlo ANTES de pedir la confirmación.
 */
export async function getProjectDeletionSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await summarizeDeletion(req.project as IProject);
    return res.json({ success: true, data: { summary } });
  } catch (error) {
    return next(error);
  }
}

/**
 * Manda la obra a la papelera. Requiere `requireProjectAccess` +
 * `requireCapability('project.delete')`.
 *
 * El body trae el nombre de la obra: quien la elimina tiene que escribirlo, y
 * el servidor lo vuelve a chequear. Un botón que borra con un click se aprieta
 * sin querer; una API que borra con un `curl` mal pegado, también.
 */
export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();

    const parsed = deleteProjectSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Escribí el nombre de la obra para confirmar.');

    const project = req.project as IProject;
    if (parsed.data.confirmName !== project.name.trim()) {
      throw badRequest('El nombre no coincide con el de la obra.');
    }

    const trashed = await moveToTrash(project, req.user.sub);
    if (!trashed?.purgeAt) throw notFound('No encontramos esa obra.');

    resyncExtras(project);

    return res.json({
      success: true,
      data: { projectId: String(trashed._id), purgeAt: trashed.purgeAt.toISOString() },
    });
  } catch (error) {
    return next(error);
  }
}

/** La papelera de quien pregunta: sus obras eliminadas que todavía se pueden restaurar. */
export async function listDeletedProjects(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    return res.json({ success: true, data: { projects: await listTrash(req.user.sub) } });
  } catch (error) {
    return next(error);
  }
}

/**
 * Saca una obra de la papelera. No pasa por `requireProjectAccess` —que
 * esconde las eliminadas—: sólo el gerente (`createdBy`) restaura.
 *
 * Una obra restaurada vuelve a contar para el límite de la suscripción, así
 * que se chequea igual que al crear una: restaurar no es una puerta lateral
 * para tener cuatro obras en el mes gratis.
 */
export async function restoreProject(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();

    const project = await findRestorable(String(req.params.projectId), req.user.sub).catch(() => null);
    if (!project) throw notFound('No encontramos esa obra en la papelera.');

    if (project.status === 'active') {
      const decision = await decideProjectCreation(project.organization, req.user.sub);
      if (!decision.allowed) throw new AppError(decision.code, RESTORE_BLOCKED[decision.code]);
    }

    const restored = await restoreFromTrash(project);
    if (!restored) throw notFound('No encontramos esa obra en la papelera.');

    resyncExtras(restored);

    return res.json({ success: true, data: { project: toProjectDTO(restored) } });
  } catch (error) {
    return next(error);
  }
}
