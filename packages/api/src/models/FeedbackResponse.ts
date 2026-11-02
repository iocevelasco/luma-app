import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  FEEDBACK_CHANGE_MAX_LENGTH,
  FEEDBACK_COMMENT_MAX_LENGTH,
  FEEDBACK_SCORE_MAX,
  FEEDBACK_SCORE_MIN,
} from '@luma/shared';

/**
 * Una respuesta a la encuesta de productividad, una fila por vez que la persona
 * contesta. Sólo el hecho: promedios y "cuándo toca preguntar" se calculan en
 * `@luma/shared/feedback`, nunca se guardan.
 *
 * El comentario es texto libre y puede traer datos personales: por eso la fila
 * se borra al purgar la cuenta (`USER_REFERENCES`) y el panel de plataforma lo
 * muestra sin autor.
 */
export interface IFeedbackResponse extends Document {
  user: mongoose.Types.ObjectId;
  timeSaved: number;
  clarity: number;
  control: number;
  /** Qué feature o qué cosa cambiaría. Opcional. */
  change?: string;
  comment?: string;
  createdAt: Date;
}

const score = { type: Number, required: true, min: FEEDBACK_SCORE_MIN, max: FEEDBACK_SCORE_MAX };

const feedbackResponseSchema = new Schema<IFeedbackResponse>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timeSaved: score,
    clarity: score,
    control: score,
    change: { type: String, trim: true, maxlength: FEEDBACK_CHANGE_MAX_LENGTH },
    comment: { type: String, trim: true, maxlength: FEEDBACK_COMMENT_MAX_LENGTH },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "Cuándo respondió por última vez esta persona".
feedbackResponseSchema.index({ user: 1, createdAt: -1 });

export const FeedbackResponse: Model<IFeedbackResponse> =
  (mongoose.models.FeedbackResponse as Model<IFeedbackResponse>) ??
  mongoose.model<IFeedbackResponse>('FeedbackResponse', feedbackResponseSchema);

export default FeedbackResponse;
