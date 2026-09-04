import { Router } from 'express';
import mongoose from 'mongoose';
import {
  createActivitySchema,
  updateActivitySchema,
  updateActivityStatusSchema,
  currentWeekKey,
  isoWeekKey,
} from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ActivityModel } from '../models/Activity.js';
import { MaterialModel } from '../models/Material.js';
import { audit } from '../services/audit.service.js';
import { notFound } from '../utils/errors.js';

export const activitiesRouter = Router();

activitiesRouter.use(isAuthenticated, withProject);

/** RF-01: la semana es la unidad de planificación; el día es opcional. */
activitiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    };
    if (req.query.week) filter.week = req.query.week;
    if (req.query.status) filter.status = req.query.status;

    const activities = await ActivityModel.find(filter)
      .sort({ order: 1, planned_start: 1 })
      .lean();

    // Los materiales pendientes por actividad se traen en una sola agregación:
    // el "material que bloquea" es la razón principal por la que alguien mira
    // esta pantalla, y N+1 queries en obra con mala señal se nota.
    const blocking = await MaterialModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      {
        $match: {
          project_id: new mongoose.Types.ObjectId(req.projectId!),
          status: 'pending',
          activity_id: { $ne: null },
        },
      },
      { $group: { _id: '$activity_id', count: { $sum: 1 } } },
    ]);
    const blockingByActivity = new Map(blocking.map((b) => [b._id.toString(), b.count]));

    const now = Date.now();
    res.json({
      success: true,
      data: activities.map((a) => ({
        ...a,
        id: a._id.toString(),
        is_late: a.status !== 'done' && a.planned_end.getTime() < now,
        blocking_materials: blockingByActivity.get(a._id.toString()) ?? 0,
      })),
    });
  }),
);

activitiesRouter.get(
  '/week/:week',
  asyncHandler(async (req, res) => {
    const activities = await ActivityModel.find({
      project_id: new mongoose.Types.ObjectId(req.projectId!),
      week: req.params.week || currentWeekKey(),
    })
      .sort({ order: 1, planned_start: 1 })
      .lean();
    res.json({ success: true, data: activities.map((a) => ({ ...a, id: a._id.toString() })) });
  }),
);

activitiesRouter.post(
  '/',
  requirePermission('planning.manage'),
  validateBody(createActivitySchema),
  asyncHandler(async (req, res) => {
    const activity = await ActivityModel.create({
      ...req.body,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
      // `week` se deriva del inicio planificado. Nunca lo manda el cliente:
      // dos fuentes para el mismo dato terminan discrepando.
      week: isoWeekKey(req.body.planned_start),
    });
    res.status(201).json({ success: true, data: { ...activity.toObject(), id: activity._id } });
  }),
);

activitiesRouter.patch(
  '/:id',
  requirePermission('planning.manage'),
  validateBody(updateActivitySchema),
  asyncHandler(async (req, res) => {
    const update: Record<string, unknown> = { ...req.body };
    if (req.body.planned_start) update.week = isoWeekKey(req.body.planned_start);

    const activity = await ActivityModel.findOneAndUpdate(
      { _id: req.params.id, project_id: new mongoose.Types.ObjectId(req.projectId!) },
      update,
      { new: true },
    );
    if (!activity) throw notFound('Actividad no encontrada');

    if (req.body.planned_start || req.body.planned_end) {
      await audit({
        projectId: req.projectId!,
        userId: req.user!.sub,
        action: 'activity.reschedule',
        entity: 'Activity',
        entityId: activity._id.toString(),
        summary: `Se movieron las fechas de "${activity.name}"`,
      });
    }

    res.json({ success: true, data: { ...activity.toObject(), id: activity._id } });
  }),
);

/**
 * RF-04: cambio de estado en un solo toque desde el móvil.
 *
 * Es el endpoint de mayor frecuencia del producto — el asistente de obra lo
 * usa varias veces por día — así que hace lo mínimo: un update y nada más.
 */
activitiesRouter.patch(
  '/:id/status',
  requirePermission('planning.update_status'),
  validateBody(updateActivityStatusSchema),
  asyncHandler(async (req, res) => {
    const { status, blocked_reason, photo_url } = req.body;

    const update: Record<string, unknown> = {
      status,
      blocked_reason: status === 'blocked' ? blocked_reason : undefined,
      completed_at: status === 'done' ? new Date() : null,
    };
    if (photo_url) update.$push = { progress_photos: photo_url };

    const { $push, ...set } = update as { $push?: unknown };
    const activity = await ActivityModel.findOneAndUpdate(
      { _id: req.params.id, project_id: new mongoose.Types.ObjectId(req.projectId!) },
      $push ? { $set: set, $push } : { $set: set },
      { new: true },
    );
    if (!activity) throw notFound('Actividad no encontrada');

    res.json({ success: true, data: { ...activity.toObject(), id: activity._id } });
  }),
);

activitiesRouter.delete(
  '/:id',
  requirePermission('planning.manage'),
  asyncHandler(async (req, res) => {
    const result = await ActivityModel.deleteOne({
      _id: req.params.id,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (result.deletedCount === 0) throw notFound('Actividad no encontrada');

    // Los materiales quedan, desvinculados: son faltantes reales de la obra
    // aunque la actividad que los pedía ya no exista.
    await MaterialModel.updateMany(
      { project_id: new mongoose.Types.ObjectId(req.projectId!), activity_id: req.params.id },
      { activity_id: null },
    );

    res.json({ success: true, data: { message: 'Actividad eliminada' } });
  }),
);
