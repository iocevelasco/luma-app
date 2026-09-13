import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { AccountStatus, UserRole } from '@luma/shared';

/**
 * Usuario de la aplicación.
 *
 * Todos los campos sensibles van con `select: false`: la contraseña y los tokens
 * de reset, verificación y cambio de email nunca salen en un `find()` común. Para
 * usarlos hay que pedirlos explícitamente (`.select('+password')`), lo que hace
 * visible en el código cada lugar donde se tocan.
 *
 * La baja es lógica: `account_status: 'inactive'` + `enabled: false`. Borrar el
 * documento rompería cualquier referencia histórica que el producto agregue después.
 */
export interface IUser extends Document {
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  password?: string;
  role: UserRole;

  resetToken?: string;
  resetTokenExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationTokenExpires?: Date;
  pendingEmail?: string;
  emailChangeToken?: string;
  emailChangeTokenExpires?: Date;

  enabled: boolean;
  account_status: AccountStatus;
  deactivated_at?: Date;
  deactivated_by?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email_verified: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    picture: { type: String },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
      required: true,
    },

    resetToken: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationTokenExpires: { type: Date, select: false },
    pendingEmail: { type: String, select: false, lowercase: true, trim: true },
    emailChangeToken: { type: String, select: false },
    emailChangeTokenExpires: { type: Date, select: false },

    enabled: { type: Boolean, default: true },
    account_status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    deactivated_at: { type: Date },
    deactivated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ?? mongoose.model<IUser>('User', userSchema);

export default User;
