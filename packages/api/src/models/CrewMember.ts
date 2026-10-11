import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { CrewMemberKind, ProviderScope, ProviderSpecialty } from '@luma/shared';

/**
 * Personal fijo de obra: el que está toda la ejecución haciendo actividades
 * varias, a diferencia del proveedor que entra, termina una tarea y se va.
 *
 * Una misma fila puede ser una persona o un equipo entero ("los tres de
 * albañilería"): es a quién se le asigna una meta, y separar Equipo en su
 * propia entidad duplicaría el roster sin ganar nada.
 *
 * Baja lógica con `active`, igual que `Provider`: alguien que ya no está
 * sigue siendo el dueño de las metas de las semanas que ya pasaron.
 */
export interface ICrewMember extends Document {
  organization: mongoose.Types.ObjectId;
  scope: ProviderScope;
  project?: mongoose.Types.ObjectId | null;
  name: string;
  kind: CrewMemberKind;
  specialty?: ProviderSpecialty;
  isLead: boolean;
  phone?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const crewMemberSchema = new Schema<ICrewMember>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    scope: { type: String, enum: ['organization', 'project'], default: 'organization' },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['persona', 'equipo'], default: 'persona' },
    specialty: {
      type: String,
      enum: [
        'electricidad',
        'plomeria',
        'gas',
        'carpinteria',
        'cristaleria',
        'albanileria',
        'herreria',
        'redes',
        'mecanicas',
        'estructura',
        'acabados',
        'pintura',
        'climatizacion',
        'techos',
        'pisos_revestimientos',
        'jardineria',
        'demolicion',
        'otra',
      ],
    },
    isLead: { type: Boolean, default: false },
    phone: { type: String, trim: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

crewMemberSchema.index({ organization: 1, active: 1 });

export const CrewMember: Model<ICrewMember> =
  (mongoose.models.CrewMember as Model<ICrewMember>) ??
  mongoose.model<ICrewMember>('CrewMember', crewMemberSchema);

export default CrewMember;
