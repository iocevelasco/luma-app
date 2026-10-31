import {
  isSpaceScoped,
  type DocumentCategory,
  type ProjectDocument,
} from '@luma/shared';
import type { IEntity } from '@svar-ui/react-filemanager';

/**
 * El orden de las categorías no es el del enum: primero los permisos y las
 * condiciones, que es lo que alguien viene a buscar con urgencia —el encargado
 * del edificio pidiendo el permiso en la puerta—, y después planos y renders.
 */
export const CATEGORY_ORDER: DocumentCategory[] = [
  'permiso_edificio',
  'permiso_municipal',
  'condiciones_sitio',
  'horario_trabajo',
  'plano',
  'render',
  'otra',
];

/** A qué carpeta de la base corresponde una carpeta del explorador. */
export interface FolderRef {
  category: DocumentCategory;
  /** Sólo en las carpetas de espacio, dentro de `plano` y `render`. */
  space?: string;
}

export interface DocumentTree {
  /** Lo que recibe el explorador en `data`. */
  entities: IEntity[];
  folders: Map<string, FolderRef>;
  files: Map<string, ProjectDocument>;
}

/**
 * El explorador arma el árbol y el nombre que muestra a partir del `id`, que es
 * una ruta: una barra dentro de un título o de un espacio crearía una carpeta
 * que no existe.
 */
export function pathSegment(value: string): string {
  return value.replace(/[\\/]+/g, '-').trim();
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot) : '';
}

/**
 * El nombre con extensión que se muestra. El título no la lleva (es lo que la
 * persona escribió), pero el explorador deduce el ícono de la extensión.
 */
export function displayName(doc: Pick<ProjectDocument, 'title' | 'fileName'>): string {
  const ext = extensionOf(doc.fileName);
  const title = pathSegment(doc.title);
  return ext && !title.toLowerCase().endsWith(ext.toLowerCase()) ? `${title}${ext}` : title;
}

/** Inverso de `displayName`: lo que se guarda como título al renombrar o subir. */
export function titleFromName(name: string, fileName: string): string {
  const ext = extensionOf(fileName);
  const trimmed = name.trim();
  return ext && trimmed.toLowerCase().endsWith(ext.toLowerCase())
    ? trimmed.slice(0, -ext.length).trim()
    : trimmed;
}

/** `/Planos/Cocina` — el nombre de la carpeta es el que se lee, no la clave. */
function folderId(label: string, space?: string): string {
  return space ? `/${pathSegment(label)}/${pathSegment(space)}` : `/${pathSegment(label)}`;
}

/**
 * Las carpetas son virtuales: salen de `category` y `space` de cada documento.
 * No existe un modelo de carpeta, así que mover un archivo es cambiarle esos
 * dos campos y nada más.
 *
 * Las siete categorías aparecen siempre, aunque estén vacías: es donde se sube.
 * `draftSpaces` son carpetas de espacio recién creadas que todavía no tienen
 * ningún archivo; viven sólo en la pantalla hasta que se sube algo adentro.
 */
export function buildDocumentTree(
  docs: ProjectDocument[],
  draftSpaces: FolderRef[],
  categoryLabel: (category: DocumentCategory) => string,
): DocumentTree {
  const entities: IEntity[] = [];
  const folders = new Map<string, FolderRef>();
  const files = new Map<string, ProjectDocument>();

  CATEGORY_ORDER.forEach((category, order) => {
    const id = folderId(categoryLabel(category));
    folders.set(id, { category });
    entities.push({ id, type: 'folder', order });
  });

  const addSpace = (category: DocumentCategory, space: string) => {
    const id = folderId(categoryLabel(category), space);
    if (folders.has(id)) return;
    folders.set(id, { category, space });
    entities.push({ id, type: 'folder' });
  };

  for (const doc of docs) {
    if (doc.space && isSpaceScoped(doc.category)) addSpace(doc.category, doc.space);
  }
  for (const draft of draftSpaces) {
    if (draft.space && isSpaceScoped(draft.category)) addSpace(draft.category, draft.space);
  }

  // Por antigüedad y no por el orden de la lista: el sufijo ` (n)` de un nombre
  // repetido no puede cambiar cuando se sube un documento nuevo.
  const byAge = [...docs].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );

  for (const doc of byAge) {
    const space = doc.space && isSpaceScoped(doc.category) ? doc.space : undefined;
    const parent = folderId(categoryLabel(doc.category), space);

    // Dos documentos con el mismo nombre en una carpeta serían el mismo `id`.
    const name = displayName(doc);
    const ext = extensionOf(name);
    const base = ext ? name.slice(0, -ext.length) : name;
    let id = `${parent}/${name}`;
    for (let n = 2; files.has(id); n += 1) id = `${parent}/${base} (${n})${ext}`;

    files.set(id, doc);
    entities.push({
      id,
      type: 'file',
      size: doc.sizeBytes,
      date: new Date(doc.createdAt),
    });
  }

  return { entities, folders, files };
}

/** Los documentos que hay dentro de una carpeta de espacio. */
export function documentsInSpace(tree: DocumentTree, folder: FolderRef): ProjectDocument[] {
  return [...tree.files.values()].filter(
    (doc) => doc.category === folder.category && (doc.space || '') === (folder.space || ''),
  );
}

export type SpaceNameCheck = 'ok' | 'empty' | 'tooLong' | 'exists';

/** Lo mismo que acepta la API en `space` (120 caracteres). */
export const SPACE_MAX_LENGTH = 120;

/**
 * Valida el nombre de un espacio nuevo o renombrado. Un espacio que ya existe
 * se rechaza: renombrar uno a otro lo fusionaría sin forma de volver atrás.
 * `current` es el nombre actual cuando se renombra (dejarlo igual no es un choque).
 */
export function checkSpaceName(
  tree: DocumentTree,
  category: DocumentCategory,
  name: string,
  current?: string,
): SpaceNameCheck {
  if (!name) return 'empty';
  if (name.length > SPACE_MAX_LENGTH) return 'tooLong';
  if (name === current) return 'ok';
  const exists = [...tree.folders.values()].some(
    (folder) => folder.category === category && folder.space === name,
  );
  return exists ? 'exists' : 'ok';
}

export interface DocumentMove {
  documentId: string;
  category: DocumentCategory;
  /** `''` es "sin espacio": omitirlo dejaría el espacio viejo en una categoría que no lo usa. */
  space: string;
}

export type MovePlan = { error: 'root' | 'folders' } | { changes: DocumentMove[] };

/**
 * Qué hay que cambiar para mover `ids` a la carpeta `target`. Los documentos que
 * ya están ahí no se tocan: un PATCH sin cambios igual avisaría "actualizado".
 */
export function planMove(tree: DocumentTree, ids: string[], target: string): MovePlan {
  const destination = tree.folders.get(target);
  if (!destination) return { error: 'root' };

  const docs = ids.map((id) => tree.files.get(id));
  if (docs.some((doc) => !doc)) return { error: 'folders' };

  const changes = (docs as ProjectDocument[])
    .filter(
      (doc) =>
        doc.category !== destination.category || (doc.space || '') !== (destination.space ?? ''),
    )
    .map((doc) => ({
      documentId: doc.id,
      category: destination.category,
      space: destination.space ?? '',
    }));
  return { changes };
}
