import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  clientDecisionSchema,
  createContingencySchema,
  internalApprovalSchema,
  updateContingencySchema,
} from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ContingencyModel } from '../models/Contingency.js';
import * as contingencyService from '../services/contingency.service.js';
import { forbidden, notFound } from '../utils/errors.js';

export const contingenciesRouter = Router();

contingenciesRouter.use(isAuthenticated, withProject);

/**
 * Un cliente sólo ve los imprevistos que le fueron comunicados y los ya
 * decididos. Los borradores y lo que está en curaduría interna no existen para
 * él (regla de negocio 4).
 */
const CLIENT_VISIBLE_STATUSES = [
  'sent_to_client',
  'client_approved',
  'client_rejected',
  'alternative_requested',
];

contingenciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    };
    if (req.projectRole === 'client') filter.status = { $in: CLIENT_VISIBLE_STATUSES };
    else if (req.query.status) filter.status = req.query.status;

    const list = await ContingencyModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: list.map((c) => ({ ...c, id: c._id.toString() })) });
  }),
);

contingenciesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await ContingencyModel.findOne({
      _id: req.params.id,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    }).lean();
    if (!doc) throw notFound('Imprevisto no encontrado');

    if (req.projectRole === 'client' && !CLIENT_VISIBLE_STATUSES.includes(doc.status)) {
      throw notFound('Imprevisto no encontrado');
    }

    res.json({ success: true, data: { ...doc, id: doc._id.toString() } });
  }),
);

/**
 * Alta del imprevisto.
 *
 * `submit=false` lo deja en borrador. Es lo que hace el asistente de obra
 * desde el celular: registra lo que vio y el encargado lo completa. La matriz
 * del §2.5 dice justamente eso — "crear imprevisto: asistente sí, queda en
 * borrador".
 */
contingenciesRouter.post(
  '/',
  requirePermission('contingency.create'),
  validateBody(createContingencySchema),
  asyncHandler(async (req, res) => {
    const submit = req.query.submit !== 'false' && req.projectRole !== 'assistant';
    const doc = await contingencyService.createContingency({
      projectId: req.projectId!,
      userId: req.user!.sub,
      input: req.body,
      submit,
    });
    res.status(201).json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);

contingenciesRouter.patch(
  '/:id',
  requirePermission('contingency.create'),
  validateBody(updateContingencySchema),
  asyncHandler(async (req, res) => {
    const doc = await ContingencyModel.findOne({
      _id: req.params.id,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (!doc) throw notFound('Imprevisto no encontrado');

    // Una vez comunicado al cliente, el contenido se congela: editar el texto
    // de algo que el cliente ya recibió por email es cambiarle la historia.
    if (!['draft', 'pending_internal', 'alternative_requested'].includes(doc.status)) {
      throw forbidden(
        'Este imprevisto ya salió de la revisión interna y no se puede editar',
        'LOCKED',
      );
    }

    Object.assign(doc, req.body);
    await doc.save();
    res.json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);

/** Paso 1 → 2: el borrador entra a revisión interna. */
contingenciesRouter.post(
  '/:id/submit',
  requirePermission('contingency.create'),
  asyncHandler(async (req, res) => {
    const doc = await ContingencyModel.findOne({
      _id: req.params.id,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (!doc) throw notFound('Imprevisto no encontrado');

    doc.history.push({
      at: new Date().toISOString(),
      by: req.user!.sub,
      from_status: doc.status,
      to_status: 'pending_internal',
    });
    doc.status = 'pending_internal';
    await doc.save();

    res.json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);

/** Paso 2: aprobación interna. Ningún imprevisto llega al cliente sin esto. */
contingenciesRouter.post(
  '/:id/approve-internal',
  requirePermission('contingency.approve_internal'),
  validateBody(internalApprovalSchema),
  asyncHandler(async (req, res) => {
    const doc = await contingencyService.approveInternally({
      projectId: req.projectId!,
      contingencyId: req.params.id,
      userId: req.user!.sub,
      impactCost: req.body.impact_cost,
      impactDays: req.body.impact_days,
      comment: req.body.comment,
    });
    res.json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);

/** Paso 3: comunicación al cliente, con contexto presupuestal. */
contingenciesRouter.post(
  '/:id/send-to-client',
  requirePermission('contingency.approve_internal'),
  asyncHandler(async (req, res) => {
    const doc = await contingencyService.sendToClient({
      projectId: req.projectId!,
      contingencyId: req.params.id,
      userId: req.user!.sub,
    });
    res.json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);

/** Pasos 4 y 5: el cliente decide y el cronograma se reacomoda solo. */
contingenciesRouter.post(
  '/:id/client-decision',
  requirePermission('contingency.decide_client'),
  validateBody(clientDecisionSchema),
  asyncHandler(async (req, res) => {
    const doc = await contingencyService.recordClientDecision({
      projectId: req.projectId!,
      contingencyId: req.params.id,
      userId: req.user!.sub,
      decision: req.body.decision,
      comment: req.body.comment,
      chosenOption: req.body.chosen_option,
    });
    res.json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);

contingenciesRouter.post(
  '/:id/cancel',
  requirePermission('contingency.approve_internal'),
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().max(500).optional() }).parse(req.body);
    const doc = await ContingencyModel.findOne({
      _id: req.params.id,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (!doc) throw notFound('Imprevisto no encontrado');
    if (['client_approved', 'client_rejected'].includes(doc.status)) {
      throw forbidden('Un imprevisto ya decidido por el cliente no se cancela', 'LOCKED');
    }

    doc.history.push({
      at: new Date().toISOString(),
      by: req.user!.sub,
      from_status: doc.status,
      to_status: 'cancelled',
      comment: reason,
    });
    doc.status = 'cancelled';
    await doc.save();

    res.json({ success: true, data: { ...doc.toObject(), id: doc._id.toString() } });
  }),
);
