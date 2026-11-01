import { z } from 'zod';
import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  FEEDBACK_SCORE_MAX,
  FEEDBACK_SCORE_MIN,
} from '../feedback/index.js';

const scoreSchema = z.number().int().min(FEEDBACK_SCORE_MIN).max(FEEDBACK_SCORE_MAX);

/** Las tres preguntas son obligatorias; el comentario no. */
export const submitFeedbackSchema = z.object({
  timeSaved: scoreSchema,
  clarity: scoreSchema,
  control: scoreSchema,
  comment: z.string().trim().max(FEEDBACK_COMMENT_MAX_LENGTH).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
