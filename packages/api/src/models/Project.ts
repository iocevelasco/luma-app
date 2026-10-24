import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ProjectStatus } from '@luma/shared';

/**
 * Obra o remodelación. `organization` se resuelve server-side desde el
 * `OrganizationMember` de quien la crea — nunca viaja en el body de la request.
 *
 * `estimatedStartDate`/`estimatedEndDate` son strings `YYYY-MM-DD`, no `Date`:
 * ver CLAUDE.md sobre cómo Safari parsea fechas y cómo un `Date` guardado se
 * corre un día según el timezone de quien lo lee.
 */
export interface IProject extends Document {
  organization: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  name: string;
  description: string;
  location: string;
  size?: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  currency: string;
  status: ProjectStatus;
  /**
   * Cuándo se archivó. La suscripción cobra cada obra por los meses en que
   * estuvo activa, y con sólo `status` no se sabe desde cuándo dejó de
   * estarlo. Lo pone el hook de abajo: nadie lo escribe a mano.
   */
  archivedAt: Date | null;
  /**
   * Papelera. Una obra eliminada no se borra: queda con `deletedAt` y se
   * esconde de todas las consultas (ver el hook de abajo). Sus datos
   * —actividades, gastos, cobros— no se tocan, así que restaurarla es limpiar
   * estos tres campos. `purgeAt` es cuándo la barre `purge-deleted-projects`.
   */
  deletedAt: Date | null;
  deletedBy: mongoose.Types.ObjectId | null;
  purgeAt: Date | null;
  providersVisibleToClient: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    size: { type: String, trim: true },
    estimatedStartDate: { type: String, required: true },
    estimatedEndDate: { type: String, required: true },
    currency: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    purgeAt: { type: Date, default: null, index: true },
    // Default cerrado: el cliente no ve proveedores salvo que el dueño lo
    // habilite — la regla 4 del documento (nada de información operativa
    // interna) es el default, y esto es la excepción explícita.
    providersVisibleToClient: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/**
 * `archivedAt` sigue a `status`, cualquiera sea el camino del cambio: un
 * `save()` o un `findByIdAndUpdate()`. Reactivar una obra la limpia, y desde
 * ahí vuelve a contar como activa.
 */
projectSchema.pre('save', function stampArchivedAt(next) {
  if (this.isModified('status')) {
    this.archivedAt = this.status === 'archived' ? new Date() : null;
  }
  next();
});

projectSchema.pre('findOneAndUpdate', function stampArchivedAtOnUpdate(next) {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (!update || Array.isArray(update)) return next();
  const status = (update.status ?? (update.$set as Record<string, unknown> | undefined)?.status) as
    | ProjectStatus
    | undefined;
  if (status) this.set('archivedAt', status === 'archived' ? new Date() : null);
  next();
});

/**
 * Las obras en la papelera no existen para nadie: ni para el listado, ni para
 * el control de acceso, ni para el conteo de la suscripción, ni para ningún
 * `Project.find` que se escriba mañana. Filtrar a mano en cada consulta es el
 * olvido que deja una obra "eliminada" visible en una pantalla.
 *
 * Quien necesite las eliminadas lo pide **nombrando el campo** —
 * `{ deletedAt: { $ne: null } }— y el hook no se mete. Sólo la papelera, el
 * restaurar y el purgado lo hacen.
 */
const HIDE_DELETED_ON = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'countDocuments',
  'distinct',
  'updateOne',
  'updateMany',
] as const;

for (const op of HIDE_DELETED_ON) {
  projectSchema.pre(op, function hideDeleted(next) {
    if (!Object.hasOwn(this.getFilter(), 'deletedAt')) this.where({ deletedAt: null });
    next();
  });
}

export const Project: Model<IProject> =
  (mongoose.models.Project as Model<IProject>) ?? mongoose.model<IProject>('Project', projectSchema);

export default Project;
