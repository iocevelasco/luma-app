import { Router } from 'express';
import mongoose from 'mongoose';
import { createMaterialSchema, updateMaterialSchema } from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { MaterialModel } from '../models/Material.js';
import { ActivityModel } from '../models/Activity.js';
import { audit } from '../services/audit.service.js';
import { notFound } from '../utils/errors.js';

export const materialsRouter = Router();

materialsRouter.use(isAuthenticated, withProject);

materialsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.activity_id) filter.activity_id = req.query.activity_id;

    const materials = await MaterialModel.find(filter).sort({ createdAt: -1 }).lean();

    const activityIds = materials.map((m) => m.activity_id).filter(Boolean);
    const activities = await ActivityModel.find({ _id: { $in: activityIds } })
      .select({ name: 1, week: 1 })
      .lean();
    const byId = new Map(activities.map((a) => [a._id.toString(), a]));

    res.json({
      success: true,
      data: materials.map((m) => ({
        ...m,
        id: m._id.toString(),
        activity: m.activity_id ? byId.get(m.activity_id.toString())?.name : undefined,
      })),
    });
  }),
);

/**
 * Lista consolidada de compras (RF-02), lista para mandar al corralón.
 *
 * Agrupa por nombre y unidad porque el mismo material pedido desde tres
 * actividades es UNA compra, no tres.
 */
materialsRouter.get(
  '/shopping-list',
  asyncHandler(async (req, res) => {
    const rows = await MaterialModel.aggregate([
      {
        $match: {
          project_id: new mongoose.Types.ObjectId(req.projectId!),
          status: { $in: ['pending', 'requested'] },
        },
      },
      {
        $group: {
          _id: { name: '$name', unit: '$unit' },
          quantity: { $sum: '$quantity' },
          estimated_cost: { $sum: '$estimated_cost' },
          items: { $sum: 1 },
        },
      },
      { $sort: { estimated_cost: -1 } },
    ]);

    res.json({
      success: true,
      data: rows.map((r) => ({
        name: r._id.name,
        unit: r._id.unit,
        quantity: r.quantity,
        estimated_cost: r.estimated_cost,
        requests: r.items,
      })),
    });
  }),
);

materialsRouter.post(
  '/',
  requirePermission('materials.manage'),
  validateBody(createMaterialSchema),
  asyncHandler(async (req, res) => {
    const material = await MaterialModel.create({
      ...req.body,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
      created_by: new mongoose.Types.ObjectId(req.user!.sub),
    });
    res.status(201).json({ success: true, data: { ...material.toObject(), id: material._id } });
  }),
);

materialsRouter.patch(
  '/:id',
  requirePermission('materials.manage'),
  validateBody(updateMaterialSchema),
  asyncHandler(async (req, res) => {
    const material = await MaterialModel.findOneAndUpdate(
      { _id: req.params.id, project_id: new mongoose.Types.ObjectId(req.projectId!) },
      req.body,
      { new: true },
    );
    if (!material) throw notFound('Material no encontrado');

    // Comprar mueve plata de "disponible" a "ejecutado": eso es una acción que
    // afecta al presupuesto, y la regla 7 pide que quede auditada.
    if (req.body.status === 'purchased' || req.body.actual_cost !== undefined) {
      await audit({
        projectId: req.projectId!,
        userId: req.user!.sub,
        action: 'material.purchase',
        entity: 'Material',
        entityId: material._id.toString(),
        summary: `${material.name}: ${material.status}, costo ${material.actual_cost ?? material.estimated_cost}`,
      });
    }

    res.json({ success: true, data: { ...material.toObject(), id: material._id } });
  }),
);

materialsRouter.delete(
  '/:id',
  requirePermission('materials.manage'),
  asyncHandler(async (req, res) => {
    const result = await MaterialModel.deleteOne({
      _id: req.params.id,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (result.deletedCount === 0) throw notFound('Material no encontrado');
    res.json({ success: true, data: { message: 'Material eliminado' } });
  }),
);
