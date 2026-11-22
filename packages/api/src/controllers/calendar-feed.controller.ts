import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { createCalendarFeedSchema, type CalendarFeedCreated, type CalendarFeedStatus } from '@luma/shared';
import { User } from '../models/User.js';
import { renderCalendar } from '../services/calendar-ics.js';
import {
  accountForFeedToken,
  calendarEventsFor,
  calendarTexts,
  feedUrl,
  newFeedToken,
} from '../services/calendar-feed.service.js';
import { badRequest, isDuplicateKeyError, notFound } from '../utils/errors.js';

/** Los calendarios externos refrescan cada varias horas: 15 minutos de caché no se notan. */
const FEED_MAX_AGE_SECONDS = 15 * 60;

/**
 * `GET /api/public/calendar/:token.ics?lang=` — el feed, sin sesión.
 *
 * Un token que no existe y una cuenta dada de baja responden el mismo 404. El
 * token nunca se loguea: es la llave del calendario.
 */
export async function getCalendarFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await accountForFeedToken(String(req.params.token ?? ''));
    if (!user) throw notFound('No encontramos ese calendario.');

    const language = typeof req.query.lang === 'string' ? req.query.lang : undefined;
    const events = await calendarEventsFor(String(user._id), language);
    const body = renderCalendar(calendarTexts(language).calendar, events);

    const etag = `"${crypto.createHash('sha1').update(body).digest('base64url')}"`;
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': `private, max-age=${FEED_MAX_AGE_SECONDS}`,
      ETag: etag,
      // Que ningún buscador lo indexe si la URL termina en algún lado público.
      'X-Robots-Tag': 'noindex',
    });
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    return res.send(body);
  } catch (error) {
    return next(error);
  }
}

/** `GET /api/calendar/feed` — si el feed está prendido. La URL no vuelve a salir. */
export async function getCalendarFeedStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.user?.sub).select('+calendarFeedTokenHash calendarFeedCreatedAt');
    if (!user) throw notFound('No encontramos tu cuenta.');
    const data: CalendarFeedStatus = {
      enabled: Boolean(user.calendarFeedTokenHash),
      createdAt: user.calendarFeedTokenHash ? user.calendarFeedCreatedAt?.toISOString() : undefined,
    };
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

/**
 * `POST /api/calendar/feed` `{ language }` — genera o regenera. Devuelve la URL
 * absoluta, armada por la API, y es la única vez que se ve: regenerar
 * invalida la anterior.
 */
export async function createCalendarFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createCalendarFeedSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const { token, hash } = newFeedToken();
    const createdAt = new Date();
    try {
      const { matchedCount } = await User.updateOne(
        { _id: req.user?.sub },
        { $set: { calendarFeedTokenHash: hash, calendarFeedCreatedAt: createdAt } },
      );
      if (matchedCount === 0) throw notFound('No encontramos tu cuenta.');
    } catch (error) {
      // 256 bits chocando con otro: no pasa, pero si pasa no se pisa el ajeno.
      if (isDuplicateKeyError(error)) throw badRequest('Prueba de nuevo.');
      throw error;
    }

    const data: CalendarFeedCreated = {
      url: feedUrl(token, parsed.data.language),
      createdAt: createdAt.toISOString(),
    };
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

/** `DELETE /api/calendar/feed` — apaga el feed. Lo que el calendario externo ya copió, queda. */
export async function deleteCalendarFeed(req: Request, res: Response, next: NextFunction) {
  try {
    await User.updateOne(
      { _id: req.user?.sub },
      { $unset: { calendarFeedTokenHash: '', calendarFeedCreatedAt: '' } },
    );
    const data: CalendarFeedStatus = { enabled: false };
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
