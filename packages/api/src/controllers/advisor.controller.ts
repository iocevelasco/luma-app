import type { Request, Response } from 'express';
import { sendChatMessageSchema } from '@luma/shared';
import mongoose from 'mongoose';
import { ANTHROPIC_CONFIG } from '../config/app.config.js';
import type { IProject } from '../models/Project.js';
import { askProjectAdvisor } from '../services/project-advisor.service.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes (ver
 * routes/advisor.ts) — mismo gate que `budgetRouter`: el Consultor IA puede
 * responder con datos de presupuesto, que en este corte es owner-only.
 */
export async function sendProjectAdvisorMessage(req: Request, res: Response) {
  if (!ANTHROPIC_CONFIG.ENABLED) {
    return res
      .status(503)
      .json({ success: false, error: 'El Consultor IA no está configurado en este entorno.' });
  }

  const parsed = sendChatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
  }

  try {
    const project = req.project as IProject;
    const reply = await askProjectAdvisor(
      project._id as mongoose.Types.ObjectId,
      parsed.data.message,
      parsed.data.history,
    );
    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    console.error('❌ [ADVISOR] sendProjectAdvisorMessage:', error);
    return res.status(502).json({
      success: false,
      error: 'No se pudo obtener respuesta del Consultor IA.',
      details: errMsg(error),
    });
  }
}
