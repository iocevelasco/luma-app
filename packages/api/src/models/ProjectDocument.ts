import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@luma/shared';

/**
 * Documentación de obra: permisos, condiciones del sitio, planos y renders.
 *
 * Es la columna derecha de la matriz de roles —lo que cada persona consulta
 * sobre la obra— y por eso la lectura la tienen los tres roles y la escritura
 * sólo el gerente.
 *
 * **Borrado duro, no baja lógica.** A diferencia de `Provider`, acá nada
 * referencia al documento: no hay trazabilidad que preservar, y un archivo que
 * se queda en el bucket se sigue pagando para siempre. Mismo criterio que la
 * evidencia fotográfica de `Activity`.
 *
 * El archivo vive en el storage S3-compatible; acá sólo se guarda su `key`.
 * La URL firmada se genera en cada respuesta y nunca se persiste — vence, y
 * una URL vencida guardada en la base es peor que no tener ninguna.
 */
export interface IProjectDocument extends Document {
  project: mongoose.Types.ObjectId;
  category: DocumentCategory;
  /** Sólo en `plano` y `render`: un permiso municipal es de la obra entera. */
  space?: string;
  title: string;
  notes?: string;
  /** Ruta interna en el bucket. Nunca sale en una respuesta. */
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectDocumentSchema = new Schema<IProjectDocument>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    category: { type: String, enum: [...DOCUMENT_CATEGORIES], required: true },
    space: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    key: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// La pantalla lista por obra agrupando por categoría; este índice es el orden
// en el que se lee, así que la consulta no ordena en memoria.
projectDocumentSchema.index({ project: 1, category: 1, createdAt: -1 });

export const ProjectDocument: Model<IProjectDocument> =
  (mongoose.models.ProjectDocument as Model<IProjectDocument>) ??
  mongoose.model<IProjectDocument>('ProjectDocument', projectDocumentSchema);

export default ProjectDocument;
