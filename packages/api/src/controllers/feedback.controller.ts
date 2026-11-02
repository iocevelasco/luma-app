import type { NextFunction, Request, Response } from 'express';
import {
  canSubmitFeedback,
  isFeedbackDue,
  submitFeedbackSchema,
  summarizeFeedback,
  type FeedbackStatus,
} from '@luma/shared';
import { FeedbackResponse } from '../models/FeedbackResponse.js';
import { User } from '../models/User.js';
import { conflict, notFound, unauthenticated } from '../utils/errors.js';

/** Las cuentas fijas de E2E no reciben el modal solo: taparía los flujos. */
const TEST_ACCOUNT = /@luma\.test$/i;

function userId(req: Request): string {
  if (!req.user) throw unauthenticated();
  return req.user.sub;
}

async function lastResponseAt(user: string): Promise<Date | null> {
  const last = await FeedbackResponse.findOne({ user }).sort({ createdAt: -1 }).select('createdAt');
  return last?.createdAt ?? null;
}

/** `GET /api/feedback/status` — si toca mostrar la encuesta sola. La API decide, la UI no deriva. */
export async function getFeedbackStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    const user = await User.findById(id).select('createdAt email feedbackDismissedAt');
    if (!user) throw notFound('No encontramos tu cuenta.');
    const data: FeedbackStatus = {
      due:
        !TEST_ACCOUNT.test(user.email) &&
        isFeedbackDue({
        createdAt: user.createdAt,
        lastRespondedAt: await lastResponseAt(id),
        lastDismissedAt: user.feedbackDismissedAt,
      }),
    };
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/feedback` — guarda una respuesta. */
export async function submitFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req);
    const input = submitFeedbackSchema.parse(req.body);
    if (!canSubmitFeedback(await lastResponseAt(id))) {
      throw conflict('Ya nos respondiste hace poco. ¡Gracias! Volvé a contarnos en unos días.');
    }
    await FeedbackResponse.create({ ...input, change: input.change || undefined,
      comment: input.comment || undefined, user: id });
    return res.status(201).json({ success: true, data: { due: false } satisfies FeedbackStatus });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/feedback/dismiss` — "ahora no": se vuelve a preguntar en 7 días. */
export async function dismissFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    await User.updateOne({ _id: userId(req) }, { feedbackDismissedAt: new Date() });
    return res.json({ success: true, data: { due: false } satisfies FeedbackStatus });
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /api/admin/feedback` — resultados agregados, sin ids ni nombres. Debajo
 * del umbral de personas salen sin cifras (ver `summarizeFeedback`).
 */
export async function getPlatformFeedback(_req: Request, res: Response, next: NextFunction) {
  try {
    const docs = await FeedbackResponse.find().lean();
    const report = summarizeFeedback(
      docs.map((d) => ({
        user: String(d.user),
        timeSaved: d.timeSaved,
        clarity: d.clarity,
        control: d.control,
        change: d.change,
        comment: d.comment,
        createdAt: d.createdAt,
      })),
    );
    return res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
}
