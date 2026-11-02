import { z } from 'zod';
import {
  FEEDBACK_CHANGE_MAX_LENGTH,
  FEEDBACK_COMMENT_MAX_LENGTH,
  FEEDBACK_SCORE_MAX,
  FEEDBACK_SCORE_MIN,
} from '../feedback/index.js';

const scoreSchema = z.number().int().min(FEEDBACK_SCORE_MIN).max(FEEDBACK_SCORE_MAX);

/** Las tres preguntas son obligatorias; `change` (qué cambiarías) y el comentario no. */
export const submitFeedbackSchema = z.object({
  timeSaved: scoreSchema,
  clarity: scoreSchema,
  control: scoreSchema,
  change: z.string().trim().max(FEEDBACK_CHANGE_MAX_LENGTH).optional(),
  comment: z.string().trim().max(FEEDBACK_COMMENT_MAX_LENGTH).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
