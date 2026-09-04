import { Router } from 'express';
import mongoose from 'mongoose';
import { createWorkerSchema, updateWorkerSchema, recordAttendanceSchema, toDateKey } from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { WorkerModel } from '../models/Worker.js';
import { AttendanceModel } from '../models/Attendance.js';
import { ActivityModel } from '../models/Activity.js';
import { notFound } from '../utils/errors.js';

export const personnelRouter = Router();

personnelRouter.use(isAuthenticated, withProject);

personnelRouter.get(
  '/workers',
  asyncHandler(async (req, res) => {
    const workers = await WorkerModel.find({
      project_id: new mongoose.Types.ObjectId(req.projectId!),
      ...(req.query.include_inactive === 'true' ? {} : { active: true }),
    })
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, data: workers.map((w) => ({ ...w, id: w._id.toString() })) });
  }),
);

personnelRouter.post(
  '/workers',
  requirePermission('personnel.manage'),
  validateBody(createWorkerSchema),
  asyncHandler(async (req, res) => {
    const worker = await WorkerModel.create({
      ...req.body,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    res.status(201).json({ success: true, data: { ...worker.toObject(), id: worker._id } });
  }),
);

personnelRouter.patch(
  '/workers/:id',
  requirePermission('personnel.manage'),
  validateBody(updateWorkerSchema),
  asyncHandler(async (req, res) => {
    const worker = await WorkerModel.findOneAndUpdate(
      { _id: req.params.id, project_id: new mongoose.Types.ObjectId(req.projectId!) },
      req.body,
      { new: true },
    );
    if (!worker) throw notFound('Trabajador no encontrado');
    res.json({ success: true, data: { ...worker.toObject(), id: worker._id } });
  }),
);

/**
 * Quién está hoy en la obra y en qué (RF-03).
 *
 * Devuelve el parte del día ya cruzado con el planificado: es la respuesta
 * exacta a una de las consultas del §RF-06, así que conviene que exista como
 * endpoint y no sólo como pregunta al asistente.
 */
personnelRouter.get(
  '/attendance',
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string) || toDateKey();
    const projectOid = new mongoose.Types.ObjectId(req.projectId!);

    const [records, workers, activities] = await Promise.all([
      AttendanceModel.find({ project_id: projectOid, date }).lean(),
      WorkerModel.find({ project_id: projectOid, active: true }).lean(),
      ActivityModel.find({ project_id: projectOid, status: 'in_progress' })
        .select({ name: 1, planned_headcount: 1 })
        .lean(),
    ]);

    const workerById = new Map(workers.map((w) => [w._id.toString(), w]));
    const activityById = new Map(activities.map((a) => [a._id.toString(), a]));

    const expected = activities.reduce((sum, a) => sum + (a.planned_headcount || 0), 0);
    const present = records.filter((r) => r.present).length;

    res.json({
      success: true,
      data: {
        date,
        expected,
        present,
        deficit: Math.max(expected - present, 0),
        records: records.map((r) => {
          const worker = workerById.get(r.worker_id.toString());
          return {
            id: r._id.toString(),
            worker_id: r.worker_id.toString(),
            worker_name: worker?.name,
            worker_trade: worker?.trade,
            present: r.present,
            activity_id: r.activity_id?.toString() ?? null,
            activity_name: r.activity_id
              ? activityById.get(r.activity_id.toString())?.name
              : undefined,
            notes: r.notes,
          };
        }),
        // Quien no tiene registro hoy: es lo que el asistente de obra tiene
        // que completar antes de cerrar el día.
        unrecorded: workers
          .filter((w) => !records.some((r) => r.worker_id.toString() === w._id.toString()))
          .map((w) => ({ id: w._id.toString(), name: w.name, trade: w.trade })),
      },
    });
  }),
);

/**
 * Parte diario completo en un request.
 *
 * `bulkWrite` con upsert: corregir el parte del día es reescribir el mismo
 * registro, no agregar uno nuevo — si no, "presentes hoy" cuenta doble.
 */
personnelRouter.post(
  '/attendance',
  requirePermission('personnel.manage'),
  validateBody(recordAttendanceSchema),
  asyncHandler(async (req, res) => {
    const { date, entries } = req.body;
    const projectOid = new mongoose.Types.ObjectId(req.projectId!);

    await AttendanceModel.bulkWrite(
      entries.map((entry: { worker_id: string; present: boolean; activity_id?: string | null; notes?: string }) => ({
        updateOne: {
          filter: {
            project_id: projectOid,
            worker_id: new mongoose.Types.ObjectId(entry.worker_id),
            date,
          },
          update: {
            $set: {
              present: entry.present,
              activity_id: entry.activity_id
                ? new mongoose.Types.ObjectId(entry.activity_id)
                : null,
              notes: entry.notes,
              recorded_by: new mongoose.Types.ObjectId(req.user!.sub),
            },
          },
          upsert: true,
        },
      })),
    );

    res.json({ success: true, data: { date, recorded: entries.length } });
  }),
);
