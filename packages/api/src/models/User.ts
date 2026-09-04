import mongoose, { Schema, Document } from 'mongoose';
import type { UserRole } from '@luma/shared';

/**
 * Cuenta de la persona, sin rol de negocio.
 *
 * El rol vive en ProjectMember y no acá: la misma persona es ejecutante en su
 * obra y cliente en la de otro. Meter el rol en el usuario obligaría a una
 * cuenta por sombrero, que es justo lo que rompe la adopción.
 */
export interface UserDocument extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  email_verified: boolean;
  name?: string;
  phone?: string;
  picture?: string;
  password?: string;
  role: UserRole;
  enabled: boolean;
  last_project_id?: mongoose.Types.ObjectId | null;
  resetToken?: string;
  resetTokenExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationTokenExpires?: Date;
  /** Alta por invitación: la persona todavía no eligió contraseña. */
  invitationToken?: string;
  invitationTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email_verified: { type: Boolean, default: false },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    picture: { type: String },
    // `select: false`: el hash no viaja en ninguna lectura salvo que se pida.
    password: { type: String, select: false },
    role: { type: String, enum: ['user', 'superadmin'], default: 'user', required: true },
    enabled: { type: Boolean, default: true },
    last_project_id: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    resetToken: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationTokenExpires: { type: Date, select: false },
    invitationToken: { type: String, select: false },
    invitationTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
