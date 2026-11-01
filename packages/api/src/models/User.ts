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

  /**
   * Quien invitó y tiene en pantalla el enlace de activación **vigente** porque
   * el mail no salió. Mientras esté puesto, ese enlace no prueba nada sobre
   * quién tiene la casilla: pasó por manos de otra persona.
   */
  activationLinkHeldBy?: mongoose.Types.ObjectId;
  /**
   * Quien tenía ese enlace cuando la cuenta se activó con él. La contraseña
   * la eligió alguien que no demostró tener la casilla, así que `email_verified`
   * sigue en false y nadie más puede sumar a esta cuenta hasta que la persona
   * real recupere la contraseña por mail (eso borra esta marca).
   */
  claimedViaLinkBy?: mongoose.Types.ObjectId;

  /**
   * Última aceptación de los Términos y la Política de Privacidad. Es el
   * hecho; si "está al día" lo decide `hasAcceptedCurrentTerms` en shared.
   * IP y user agent son la prueba de que la aceptación ocurrió: dato personal,
   * declarado en la Política, y `select: false` para que no salgan en un find.
   */
  termsVersion?: string;
  termsAcceptedAt?: Date;
  termsAcceptedIp?: string;
  termsAcceptedUserAgent?: string;

  /**
   * Pidió no recibir comunicados (campañas). Sólo afecta a los comerciales: los
   * correos de la cuenta y de las obras siguen llegando.
   */
  marketing_opt_out?: boolean;

  /** Última vez que descartó la encuesta de feedback. Ver `isFeedbackDue`. */
  feedbackDismissedAt?: Date;

  enabled: boolean;
  account_status: AccountStatus;
  deactivated_at?: Date;
  deactivated_by?: mongoose.Types.ObjectId;
  /**
   * Cuándo se borraron sus datos personales (ver `account-purge.service.ts`).
   * El documento queda: las obras, cobros y gastos que firmó lo referencian.
   */
  purgedAt?: Date;

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

    activationLinkHeldBy: { type: Schema.Types.ObjectId, ref: 'User' },
    claimedViaLinkBy: { type: Schema.Types.ObjectId, ref: 'User' },

    termsVersion: { type: String },
    feedbackDismissedAt: { type: Date },
    termsAcceptedAt: { type: Date },
    termsAcceptedIp: { type: String, select: false },
    termsAcceptedUserAgent: { type: String, select: false },

    marketing_opt_out: { type: Boolean, default: false },

    enabled: { type: Boolean, default: true },
    account_status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    deactivated_at: { type: Date },
    deactivated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    purgedAt: { type: Date },
  },
  { timestamps: true },
);

/**
 * Toda baja deja fecha. La purga de datos personales cuenta sus 90 días desde
 * `deactivated_at`: una cuenta que quedara `inactive` sin ella dependería de un
 * respaldo (`updatedAt`) en vez de una fecha dicha. Se completa acá, en el
 * modelo, y no en cada lugar que da de baja — hoy hay más de uno (la
 * plataforma, scripts) y mañana habrá otro.
 */
userSchema.pre('save', function stampDeactivation(next) {
  if (this.isModified('account_status') && this.account_status === 'inactive') {
    this.deactivated_at ??= new Date();
  }
  next();
});

userSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function stampDeactivation(next) {
  const update = this.getUpdate() as {
    $set?: Record<string, unknown>;
    account_status?: string;
  } | null;
  const status = update?.$set?.account_status ?? update?.account_status;
  if (status === 'inactive' && update?.$set?.deactivated_at === undefined) {
    this.set({ deactivated_at: new Date() });
  }
  next();
});

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ?? mongoose.model<IUser>('User', userSchema);

export default User;
