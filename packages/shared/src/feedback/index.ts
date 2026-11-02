import { MIN_PEOPLE_PER_CELL } from '../platform-activity/index.js';

/**
 * Encuesta de productividad: tres preguntas, escala 1 a 5. Las reglas de
 * cuándo corresponde preguntar y qué se puede mostrar viven acá, puras y con
 * tests: la API lee hechos de la base y le pregunta a este archivo; la UI
 * muestra lo que la API resolvió.
 */

export const FEEDBACK_QUESTIONS = ['timeSaved', 'clarity', 'control'] as const;
export type FeedbackQuestion = (typeof FEEDBACK_QUESTIONS)[number];

export const FEEDBACK_SCORE_MIN = 1;
export const FEEDBACK_SCORE_MAX = 5;
export const FEEDBACK_COMMENT_MAX_LENGTH = 500;

/** Días desde el alta hasta la primera vez que se pregunta sola. */
export const FEEDBACK_FIRST_AFTER_DAYS = 14;
/** Días de silencio tras responder. */
export const FEEDBACK_REPEAT_AFTER_DAYS = 90;
/** Días de silencio tras cerrar la encuesta sin responder: se vuelve a preguntar antes. */
export const FEEDBACK_DISMISS_REPEAT_AFTER_DAYS = 7;
/** Minutos de sesión abierta antes de mostrar el modal: no se cruza apenas se entra. */
export const FEEDBACK_SESSION_DELAY_MINUTES = 5;
export const FEEDBACK_CHANGE_MAX_LENGTH = 200;
/** Entre dos respuestas desde el menú: evita inflar el promedio con reenvíos. */
export const FEEDBACK_MIN_GAP_DAYS = 7;
/** Tope de comentarios que lista el panel de plataforma. */
export const FEEDBACK_REPORT_COMMENTS_LIMIT = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FeedbackFacts {
  /** Alta de la cuenta. */
  createdAt: Date;
  lastRespondedAt?: Date | null;
  lastDismissedAt?: Date | null;
  now?: Date;
}

/**
 * ¿Toca mostrar el modal solo? A los 14 días de uso la primera vez. Después,
 * 90 días desde que respondió, o 7 desde que la cerró sin responder: gana el
 * plazo que vence más tarde.
 */
export function isFeedbackDue({
  createdAt,
  lastRespondedAt,
  lastDismissedAt,
  now = new Date(),
}: FeedbackFacts): boolean {
  const waits: number[] = [];
  if (lastRespondedAt) waits.push(lastRespondedAt.getTime() + FEEDBACK_REPEAT_AFTER_DAYS * DAY_MS);
  if (lastDismissedAt) {
    waits.push(lastDismissedAt.getTime() + FEEDBACK_DISMISS_REPEAT_AFTER_DAYS * DAY_MS);
  }
  if (waits.length > 0) return now.getTime() >= Math.max(...waits);
  return now.getTime() - createdAt.getTime() >= FEEDBACK_FIRST_AFTER_DAYS * DAY_MS;
}

/** ¿Pasó el mínimo entre dos respuestas? */
export function canSubmitFeedback(lastRespondedAt: Date | null | undefined, now = new Date()) {
  if (!lastRespondedAt) return true;
  return now.getTime() - lastRespondedAt.getTime() >= FEEDBACK_MIN_GAP_DAYS * DAY_MS;
}

export interface FeedbackRow {
  user: string;
  timeSaved: number;
  clarity: number;
  control: number;
  change?: string | null;
  comment?: string | null;
  createdAt: Date;
}

export interface FeedbackReport {
  /** Respuestas totales. */
  responses: number;
  /** Personas distintas que respondieron. */
  respondents: number;
  /**
   * Con menos de `MIN_PEOPLE_PER_CELL` personas un promedio o un comentario
   * deja de ser estadística y pasa a ser "lo que dijo fulano": sale sin cifras.
   */
  suppressed: boolean;
  averages: Record<FeedbackQuestion, number> | null;
  /** Qué quieren cambiar, sin autor. */
  changes: { change: string; createdAt: string }[];
  comments: { comment: string; createdAt: string }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Agrega las respuestas. Nunca devuelve ids ni nombres. */
export function summarizeFeedback(rows: FeedbackRow[]): FeedbackReport {
  const respondents = new Set(rows.map((r) => r.user)).size;
  const base = { responses: rows.length, respondents };
  if (respondents < MIN_PEOPLE_PER_CELL) {
    return { ...base, suppressed: true, averages: null, changes: [], comments: [] };
  }
  const avg = (q: FeedbackQuestion) => round1(rows.reduce((sum, r) => sum + r[q], 0) / rows.length);
  const latest = (field: 'comment' | 'change') =>
    rows
      .filter((r) => r[field] && r[field]!.trim())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, FEEDBACK_REPORT_COMMENTS_LIMIT);
  const comments = latest('comment').map((r) => ({
    comment: r.comment as string,
    createdAt: r.createdAt.toISOString(),
  }));
  const changes = latest('change').map((r) => ({
    change: r.change as string,
    createdAt: r.createdAt.toISOString(),
  }));
  return {
    ...base,
    suppressed: false,
    averages: { timeSaved: avg('timeSaved'), clarity: avg('clarity'), control: avg('control') },
    changes,
    comments,
  };
}

export interface FeedbackStatus {
  due: boolean;
}
