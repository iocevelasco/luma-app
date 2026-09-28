import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ProviderScope, ProviderSpecialty } from '@luma/shared';

/**
 * Directorio de proveedores/subcontratistas de una Empresa (`organization`),
 * reutilizable entre todas sus obras. A diferencia de `Activity.ts`, acá SÍ
 * hay baja lógica (`active: boolean`) en vez de borrado duro: un proveedor
 * puede seguir referenciado desde `ActivityProvider` en obras ya avanzadas, y
 * borrarlo de verdad rompería la trazabilidad de "quién trabajó en esto" que
 * el documento funcional pide para todo el módulo de imprevistos.
 */
export interface IProvider extends Document {
  organization: mongoose.Types.ObjectId;
  scope: ProviderScope;
  /** Sólo con `scope: 'project'` — el proveedor que trae el cliente para UNA obra. */
  project?: mongoose.Types.ObjectId | null;
  name: string;
  companyName?: string;
  specialty: ProviderSpecialty;
  customSpecialty?: string;
  phone: string;
  email?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
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
    companyName: { type: String, trim: true },
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
      required: true,
    },
    customSpecialty: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

providerSchema.index({ organization: 1, active: 1 });

export const Provider: Model<IProvider> =
  (mongoose.models.Provider as Model<IProvider>) ??
  mongoose.model<IProvider>('Provider', providerSchema);

export default Provider;
