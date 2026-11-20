import crypto from 'node:crypto';
import { roundMoney, type CalendarFeedLanguage } from '@luma/shared';
import { SERVER_CONFIG } from '../config/app.config.js';
import { Activity } from '../models/Activity.js';
import { Milestone } from '../models/Milestone.js';
import { PaymentScheduleItem } from '../models/PaymentScheduleItem.js';
import { User, type IUser } from '../models/User.js';
import type { CalendarEvent } from './calendar-ics.js';
import { paidByScheduleItem, scheduleItemStatus } from './finance.service.js';
import { milestoneAudienceFilter } from './milestone-audience.js';
import { myProjectsWithAccess } from './my-projects.service.js';

/**
 * El feed de calendario personal (ADR-005 §3).
 *
 * **El token es la llave del calendario**: quien tenga la URL lo lee. Son 32
 * bytes aleatorios que se muestran una sola vez; en `User` queda sólo su
 * SHA-256 y el feed se busca por el hash. Regenerar invalida la URL anterior.
 *
 * **El contenido sale de la misma resolución de permisos que el panel**
 * (`myProjectsWithAccess`): el feed es otra puerta a los mismos datos.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ventana del feed: lo reciente y lo que viene. */
export const FEED_PAST_DAYS = 30;
export const FEED_FUTURE_DAYS = 365;

/** Los textos fijos del feed, por idioma. Ninguno lleva datos de plata ni texto libre. */
const TEXTS: Record<CalendarFeedLanguage, { calendar: string; meeting: string; due: string }> = {
  'es-ES': { calendar: 'Luma · Mis obras', meeting: 'Reunión', due: 'Vencimiento de cuota' },
  'es-AR': { calendar: 'Luma · Mis obras', meeting: 'Reunión', due: 'Vencimiento de cuota' },
  pt: { calendar: 'Luma · Minhas obras', meeting: 'Reunião', due: 'Vencimento de parcela' },
};

export function calendarTexts(language: string | undefined) {
  return TEXTS[(language as CalendarFeedLanguage) in TEXTS ? (language as CalendarFeedLanguage) : 'es-ES'];
}

export function hashFeedToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Un token nuevo: 32 bytes en base64url (43 caracteres, seguros en una URL). */
export function newFeedToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashFeedToken(token) };
}

/** Tiene la forma de un token: evita ir a la base con cualquier cosa. */
export function looksLikeFeedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function feedUrl(token: string, language: CalendarFeedLanguage): string {
  const base = SERVER_CONFIG.PUBLIC_API_URL.replace(/\/$/, '');
  return `${base}/api/public/calendar/${token}.ics?lang=${encodeURIComponent(language)}`;
}

/**
 * La cuenta dueña del token, si todavía puede leer su calendario. Un token que
 * no existe y una cuenta inactiva, deshabilitada o purgada son lo mismo para
 * quien pregunta: no hay feed.
 */
export async function accountForFeedToken(token: string): Promise<IUser | null> {
  if (!looksLikeFeedToken(token)) return null;
  const user = await User.findOne({ calendarFeedTokenHash: hashFeedToken(token) });
  if (!user || !user.enabled || user.account_status === 'inactive' || user.purgedAt) return null;
  return user;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Las fechas que entran en el feed, en días sueltos (`YYYY-MM-DD`). */
export function feedWindow(now: Date): { from: string; to: string; today: string } {
  return {
    today: dayKey(now),
    from: dayKey(new Date(now.getTime() - FEED_PAST_DAYS * DAY_MS)),
    to: dayKey(new Date(now.getTime() + FEED_FUTURE_DAYS * DAY_MS)),
  };
}

/**
 * Los eventos del calendario de una persona.
 *
 * - Actividades: con `activity.read`, menos las canceladas.
 * - Reuniones: hitos `reunion`, con el mismo filtro de audiencia que el
 *   listado de hitos. Sin asistentes: son nombres de terceros.
 * - Vencimientos: con `payment.read` (que ya contempla
 *   `paymentsVisibleToClient`), sólo las cuotas no cobradas y con un título
 *   fijo. `concept` y `notes` son texto libre y pueden traer el monto.
 *
 * Sin `DESCRIPTION` ni `LOCATION`. Las obras archivadas y las de la papelera no
 * salen; con la suscripción vencida el feed sigue, porque es lectura.
 */
export async function calendarEventsFor(
  userId: string,
  language: string | undefined,
  now = new Date(),
): Promise<CalendarEvent[]> {
  const texts = calendarTexts(language);
  const { from, to, today } = feedWindow(now);
  const mine = await myProjectsWithAccess(userId, { activeOnly: true, limit: 200 });
  const events: CalendarEvent[] = [];

  for (const { project, capabilities } of mine) {
    const can = (capability: string) => capabilities.includes(capability as never);
    const where = project.name;

    if (can('activity.read')) {
      const activities = await Activity.find({
        project: project._id,
        status: { $ne: 'cancelada' },
        endDate: { $gte: from },
        startDate: { $lte: to },
      }).select('name startDate endDate updatedAt');
      for (const activity of activities) {
        events.push({
          uid: `activity-${String(activity._id)}@luma`,
          summary: `${activity.name} · ${where}`,
          startDay: activity.startDate,
          endDay: activity.endDate < activity.startDate ? activity.startDate : activity.endDate,
          updatedAt: activity.updatedAt,
        });
      }
    }

    if (can('milestone.read')) {
      const meetings = await Milestone.find({
        project: project._id,
        type: 'reunion',
        occurredOn: { $gte: from, $lte: to },
        ...milestoneAudienceFilter(can),
      }).select('title occurredOn updatedAt');
      for (const meeting of meetings) {
        events.push({
          uid: `meeting-${String(meeting._id)}@luma`,
          summary: `${texts.meeting}: ${meeting.title} · ${where}`,
          startDay: meeting.occurredOn,
          endDay: meeting.occurredOn,
          updatedAt: meeting.updatedAt,
        });
      }
    }

    if (can('payment.read')) {
      const [items, paid] = await Promise.all([
        PaymentScheduleItem.find({ project: project._id, dueOn: { $gte: from, $lte: to } }).select(
          'amount exchangeRate dueOn updatedAt',
        ),
        paidByScheduleItem(String(project._id)),
      ]);
      for (const item of items) {
        const scheduled = roundMoney(item.amount * item.exchangeRate);
        const status = scheduleItemStatus(scheduled, paid.get(String(item._id)) ?? 0, item.dueOn, today);
        if (status === 'cobrado') continue;
        events.push({
          uid: `due-${String(item._id)}@luma`,
          summary: `${texts.due} · ${where}`,
          startDay: item.dueOn,
          endDay: item.dueOn,
          updatedAt: item.updatedAt,
        });
      }
    }
  }

  return events.sort((a, b) => a.startDay.localeCompare(b.startDay) || a.uid.localeCompare(b.uid));
}
