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
/** Días de silencio tras responder o descartar. */
export const FEEDBACK_REPEAT_AFTER_DAYS = 90;
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
 * ¿Toca mostrar el modal solo? A los 14 días de uso la primera vez; después,
 * 90 días desde lo último que la persona hizo (responder o descartar).
 */
export function isFeedbackDue({
  createdAt,
  lastRespondedAt,
  lastDismissedAt,
  now = new Date(),
}: FeedbackFacts): boolean {
  const touched = [lastRespondedAt, lastDismissedAt].filter((d): d is Date => d instanceof Date);
  if (touched.length > 0) {
    const last = Math.max(...touched.map((d) => d.getTime()));
    return now.getTime() - last >= FEEDBACK_REPEAT_AFTER_DAYS * DAY_MS;
  }
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
  comments: { comment: string; createdAt: string }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Agrega las respuestas. Nunca devuelve ids ni nombres. */
export function summarizeFeedback(rows: FeedbackRow[]): FeedbackReport {
  const respondents = new Set(rows.map((r) => r.user)).size;
  const base = { responses: rows.length, respondents };
  if (respondents < MIN_PEOPLE_PER_CELL) {
    return { ...base, suppressed: true, averages: null, comments: [] };
  }
  const avg = (q: FeedbackQuestion) => round1(rows.reduce((sum, r) => sum + r[q], 0) / rows.length);
  const comments = rows
    .filter((r) => r.comment && r.comment.trim())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, FEEDBACK_REPORT_COMMENTS_LIMIT)
    .map((r) => ({ comment: r.comment as string, createdAt: r.createdAt.toISOString() }));
  return {
    ...base,
    suppressed: false,
    averages: { timeSaved: avg('timeSaved'), clarity: avg('clarity'), control: avg('control') },
    comments,
  };
}

export interface FeedbackStatus {
  due: boolean;
}
