import mongoose, { Schema, Document } from 'mongoose';

/**
 * Historial del asistente conversacional (RF-06).
 *
 * "Consultable y auditable" es requisito explícito: si el asistente le dice
 * algo equivocado a alguien, tiene que poder revisarse qué respondió y con qué
 * fuentes.
 */
export interface ConversationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources: Array<{ label: string; link: string }>;
    suggested_action?: { kind: string; label: string; payload: Record<string, unknown> } | null;
    created_at: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    sources: {
      type: [new Schema({ label: String, link: String }, { _id: false })],
      default: [],
    },
    suggested_action: { type: Schema.Types.Mixed, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const conversationSchema = new Schema<ConversationDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Consulta' },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

export const ConversationModel = mongoose.model<ConversationDocument>(
  'Conversation',
  conversationSchema,
);
