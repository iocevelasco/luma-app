/**
 * Documentación de obra: permisos, condiciones del sitio, planos y renders.
 *
 * Es la columna derecha de la matriz de roles — lo que cada persona "accede a
 * consultar" sobre la obra, a diferencia de lo que reporta. Por eso la
 * escritura es sólo del gerente y la lectura la tienen los tres roles.
 */

/**
 * Las categorías salen literal de la matriz del cliente. No hay una genérica
 * de "archivo adjunto": si todo cae en una bolsa, la pantalla vuelve a ser una
 * carpeta compartida y nadie encuentra el permiso de la torre cuando el
 * encargado lo pide en la puerta.
 */
export type DocumentCategory =
  /** Condiciones de trabajo del sitio. */
  | 'condiciones_sitio'
  /** Horario de remodelación permitido. */
  | 'horario_trabajo'
  /** Permiso avalado por la torre residencial o comercial. */
  | 'permiso_edificio'
  /** Permiso de la municipalidad, cuando aplica. */
  | 'permiso_municipal'
  /** Plano de un espacio a construir. */
  | 'plano'
  /** Render de un espacio a construir. */
  | 'render'
  | 'otra';

export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  'condiciones_sitio',
  'horario_trabajo',
  'permiso_edificio',
  'permiso_municipal',
  'plano',
  'render',
  'otra',
] as const;

/**
 * Las categorías que se organizan **por espacio** ("de cada espacio a
 * construir", dice la matriz). En las otras el campo `space` no se pide:
 * un permiso municipal es de la obra entera, no del baño.
 */
export const SPACE_SCOPED_CATEGORIES: readonly DocumentCategory[] = ['plano', 'render'] as const;

export function isSpaceScoped(category: DocumentCategory): boolean {
  return SPACE_SCOPED_CATEGORIES.includes(category);
}

/** Lo que se acepta subir. Los planos y permisos llegan en PDF; los renders, como imagen. */
export const DOCUMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** 20MB: un plano en PDF pesa bastante más que una foto de avance. */
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export interface ProjectDocument {
  id: string;
  projectId: string;
  category: DocumentCategory;
  /** Sólo en `plano` y `render` — ver `SPACE_SCOPED_CATEGORIES`. */
  space?: string;
  title: string;
  notes?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /**
   * URL firmada de lectura, generada al vuelo en cada respuesta. Nunca se
   * guarda: vence, y una URL vencida en la base es peor que no tenerla.
   * `null` si el storage no está configurado en este entorno.
   */
  url: string | null;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocumentListResponse {
  documents: ProjectDocument[];
}

export interface ProjectDocumentResponse {
  document: ProjectDocument;
}

export interface DeleteProjectDocumentResponse {
  documentId: string;
}
