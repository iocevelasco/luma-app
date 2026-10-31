import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * El prompt del asistente de Luma. Hay uno solo: es el texto del proyecto
 * NexusBot, no de una Empresa. Se guarda acá y, al guardarlo, se manda a
 * NexusBot.
 */
export interface IChatPrompt extends Document {
  singleton: 'chat';
  systemPrompt: string;
  updatedBy: mongoose.Types.ObjectId | null;
  updatedAt: Date;
  createdAt: Date;
}

const chatPromptSchema = new Schema<IChatPrompt>(
  {
    singleton: { type: String, enum: ['chat'], required: true, unique: true },
    systemPrompt: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const ChatPrompt: Model<IChatPrompt> =
  (mongoose.models.ChatPrompt as Model<IChatPrompt>) ??
  mongoose.model<IChatPrompt>('ChatPrompt', chatPromptSchema);

export default ChatPrompt;
