import { useCallback, useMemo, useRef, useState } from 'react';
import { Locale } from '@svar-ui/react-core';
import {
  Filemanager,
  Willow,
  getMenuOptions,
  type IApi,
  type IFileMenuOption,
  type TContextMenuType,
} from '@svar-ui/react-filemanager';
import '@svar-ui/react-filemanager/all.css';
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  isSpaceScoped,
  type ProjectDocument,
} from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useCreateProjectDocument,
  useDeleteProjectDocuments,
  useUpdateProjectDocuments,
} from '@/hooks/documents/use-document-queries';
import { errorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import '@/lib/svar-icons';
import {
  buildDocumentTree,
  checkSpaceName,
  documentsInSpace,
  pathSegment,
  planMove,
  titleFromName,
  type FolderRef,
} from './document-tree';
import { DocumentPreview } from './document-preview';

/**
 * Las palabras que `@svar-ui/react-filemanager` trae en inglés (no publica
 * castellano). La clave es el texto original de la librería; el valor, la clave
 * de i18n donde está traducido.
 */
const SVAR_WORDS: Array<[string, string]> = [
  ['My files', 'root'],
  ['Add New', 'addNew'],
  ['Ok', 'ok'],
  ['Cancel', 'cancel'],
  ['Delete files', 'deleteFiles'],
  ['Files', 'files'],
  ['Folder', 'folder'],
  ['Back to parent folder', 'backToParent'],
  ['Information', 'information'],
  ['Found', 'found'],
  ['Are you sure you want to delete these items:', 'confirmDelete'],
  ['Enter file name', 'enterFileName'],
  ['Enter folder name', 'enterFolderName'],
  ['Result', 'result'],
  ['Search', 'search'],
  ['Search results in', 'searchResultsIn'],
  ['Add new file', 'addFile'],
  ['Add new folder', 'addFolder'],
  ['Upload file', 'upload'],
  ['Size', 'size'],
  ['Name', 'name'],
  ['Type', 'type'],
  ['Date', 'date'],
  ['Rename', 'rename'],
  ['Cut', 'cut'],
  ['Delete', 'delete'],
  ['Copy', 'copy'],
  ['Paste', 'paste'],
  ['Download', 'download'],
  ['Count', 'count'],
  ['folder', 'folderLower'],
  ['folders', 'foldersLower'],
  ['file', 'fileLower'],
  ['files', 'filesLower'],
  ['Multiple files', 'multipleFiles'],
  ['multiple', 'multiple'],
  ['Preview', 'preview'],
  ['of', 'of'],
  ['used', 'used'],
  ['Select file or folder to view details', 'selectToView'],
  ['Looks like nothing is here', 'empty'],
  ['Unknown file', 'unknownFile'],
  ['A miniature file preview', 'miniature'],
];

/** Lo que el menú de la librería no debe ofrecer, con la razón en el comentario. */
const HIDDEN_MENU_IDS = new Set([
  // Copiar duplicaría el objeto en el bucket; un plano se sube de nuevo, no se clona.
  'copy',
  // Un archivo vacío no es un documento.
  'add-file',
]);

/** Lo único que se puede hacer con una carpeta de categoría: abrirla y subir adentro. */
const CATEGORY_FOLDER_HIDDEN_IDS = new Set(['rename', 'delete', 'move']);

interface DocumentFileManagerProps {
  projectId: string;
  documents: ProjectDocument[];
  canWrite: boolean;
  /** Carpeta de categoría donde abrir el explorador (`?category=` del resumen de la obra). */
  initialCategory?: ProjectDocument['category'];
  className?: string;
}

/**
 * Explorador de la documentación de obra sobre `@svar-ui/react-filemanager`.
 *
 * No guarda estado propio del árbol: lo que ve la persona sale de `documents`
 * y cada acción de la librería se **intercepta y se cancela** (`return false`)
 * para llevarla a la API. Cuando la lista se recarga, el árbol se rearma solo.
 * Dejar que la librería aplique el cambio por su cuenta mostraría un archivo
 * movido que la API todavía no movió —o que rechazó—.
 *
 * Las carpetas son virtuales (ver `document-tree.ts`): mover es cambiar
 * `category` y `space`.
 */
export function DocumentFileManager({
  projectId,
  documents,
  canWrite,
  initialCategory,
  className,
}: DocumentFileManagerProps) {
  const { t } = useTranslation();
  const createDocument = useCreateProjectDocument(projectId);
  const updateDocuments = useUpdateProjectDocuments(projectId);
  const deleteDocuments = useDeleteProjectDocuments(projectId);

  // Espacios nuevos sin ningún archivo todavía: sólo existen en la pantalla.
  const [draftSpaces, setDraftSpaces] = useState<FolderRef[]>([]);
  // Qué documento se está viendo (doble clic). Es un id y no el objeto: la URL firmada se renueva con cada recarga.
  const [previewId, setPreviewId] = useState<string | null>(null);

  const categoryLabel = useCallback(
    (category: ProjectDocument['category']) => t(`document.category.${category}`),
    [t],
  );
  const tree = useMemo(
    () => buildDocumentTree(documents, draftSpaces, categoryLabel),
    [documents, draftSpaces, categoryLabel],
  );

  const words = useMemo(
    () => ({
      filemanager: Object.fromEntries(
        SVAR_WORDS.map(([original, key]) => [original, t(`document.fm.words.${key}`)]),
      ),
    }),
    [t],
  );

  // Los handlers se registran una vez (`init`); leen siempre lo último desde acá.
  const latest = useRef({
    tree,
    draftSpaces,
    createDocument,
    updateDocuments,
    deleteDocuments,
    t,
  });
  latest.current = { tree, draftSpaces, createDocument, updateDocuments, deleteDocuments, t };

  const handleInit = useCallback((api: IApi) => {
    const fail = (key: string) => toast.error(latest.current.t(key));

    api.intercept('rename-file', ({ id, name }) => {
      const { tree, draftSpaces, updateDocuments, t } = latest.current;
      const doc = tree.files.get(id);

      if (doc) {
        const title = titleFromName(name, doc.fileName);
        if (title) updateDocuments.mutate([{ documentId: doc.id, title }]);
        return false;
      }

      const folder = tree.folders.get(id);
      // Las categorías son fijas; sólo un espacio se puede renombrar.
      if (!folder || folder.space === undefined) return false;
      const space = pathSegment(name);
      const check = checkSpaceName(tree, folder.category, space, folder.space);
      if (check !== 'ok') {
        if (check !== 'empty') toast.error(t(`document.fm.errors.space.${check}`));
        return false;
      }
      if (space === folder.space) return false;

      setDraftSpaces(
        draftSpaces.map((draft) =>
          draft.category === folder.category && draft.space === folder.space
            ? { ...draft, space }
            : draft,
        ),
      );
      const inside = documentsInSpace(tree, folder);
      if (inside.length > 0) {
        updateDocuments.mutate(inside.map((item) => ({ documentId: item.id, space })));
      }
      return false;
    });

    api.intercept('create-file', ({ file, parent }) => {
      const { tree, draftSpaces, createDocument, t } = latest.current;
      const target = tree.folders.get(parent);

      if (!target) {
        fail('document.fm.errors.noUploadAtRoot');
        return false;
      }

      if (file.type === 'folder') {
        if (target.space !== undefined || !isSpaceScoped(target.category)) {
          fail('document.fm.errors.foldersOnlyInPlans');
          return false;
        }
        // Sin barras: el nombre es parte de la ruta de la carpeta (ver `pathSegment`).
        const space = pathSegment(file.name);
        const check = checkSpaceName(tree, target.category, space);
        if (check !== 'ok') {
          if (check !== 'empty') toast.error(t(`document.fm.errors.space.${check}`));
          return false;
        }
        setDraftSpaces([...draftSpaces, { category: target.category, space }]);
        return false;
      }

      const upload = file.file;
      if (!upload) return false;
      if (!DOCUMENT_MIME_TYPES.includes(upload.type)) {
        fail('document.errors.fileType');
        return false;
      }
      if (upload.size > DOCUMENT_MAX_BYTES) {
        fail('document.errors.fileSize');
        return false;
      }

      createDocument
        .mutateAsync({
          category: target.category,
          space: target.space,
          title: titleFromName(upload.name, upload.name) || upload.name,
          notes: undefined,
          file: upload,
        })
        .catch((error: unknown) => toast.error(errorMessage(error, t)));
      return false;
    });

    api.intercept('move-files', ({ ids, target }) => {
      const { tree, updateDocuments } = latest.current;
      const plan = planMove(tree, ids, target);

      if ('error' in plan) {
        fail(
          plan.error === 'root'
            ? 'document.fm.errors.noUploadAtRoot'
            : 'document.fm.errors.moveFolders',
        );
      } else if (plan.changes.length > 0) {
        updateDocuments.mutate(plan.changes);
      }
      return false;
    });

    api.intercept('copy-files', () => {
      fail('document.fm.errors.noCopy');
      return false;
    });

    api.intercept('delete-files', ({ ids }) => {
      const { tree, draftSpaces, deleteDocuments } = latest.current;
      const documentIds: string[] = [];
      const draftsToDrop: FolderRef[] = [];

      for (const id of ids) {
        const doc = tree.files.get(id);
        if (doc) {
          documentIds.push(doc.id);
          continue;
        }
        const folder = tree.folders.get(id);
        if (!folder || folder.space === undefined) {
          fail('document.fm.errors.noDeleteCategory');
          return false;
        }
        if (documentsInSpace(tree, folder).length > 0) {
          fail('document.fm.errors.folderNotEmpty');
          return false;
        }
        draftsToDrop.push(folder);
      }

      if (draftsToDrop.length > 0) {
        setDraftSpaces(
          draftSpaces.filter(
            (draft) =>
              !draftsToDrop.some(
                (gone) => gone.category === draft.category && gone.space === draft.space,
              ),
          ),
        );
      }
      if (documentIds.length > 0) deleteDocuments.mutate(documentIds);
      return false;
    });

    // Doble clic o Enter sobre un archivo: se abre la vista previa. Descargar
    // (menú o Ctrl+D) lo abre en otra pestaña.
    api.intercept('open-file', ({ id }) => {
      const doc = latest.current.tree.files.get(id);
      if (doc) setPreviewId(doc.id);
      return false;
    });
    api.intercept('download-file', ({ id }) => {
      const doc = latest.current.tree.files.get(id);
      if (!doc) return false;
      if (!doc.url) {
        fail('document.fm.errors.noUrl');
        return false;
      }
      // La URL está firmada y vence: se abre al momento, nunca se guarda.
      window.open(doc.url, '_blank', 'noopener,noreferrer');
      return false;
    });
  }, []);

  /*
   * La librería arma el menú al renderizar, no al abrirlo: no se puede decidir
   * por la carpeta abierta. Subir o crear una carpeta en la raíz o en un tipo
   * que no lo admite se rechaza al ejecutar la acción, con su aviso.
   */
  const menuOptions = useCallback(
    (mode: TContextMenuType, item?: { id: string }): IFileMenuOption[] | false => {
      const { tree } = latest.current;
      const folder = item ? tree.folders.get(item.id) : undefined;

      return getMenuOptions(mode).filter((option) => {
        if (option.id && HIDDEN_MENU_IDS.has(String(option.id))) return false;
        // Una carpeta de tipo es fija: sólo se abre.
        if (mode === 'folder' && folder && folder.space === undefined) {
          return !CATEGORY_FOLDER_HIDDEN_IDS.has(String(option.id));
        }
        return true;
      });
    },
    [],
  );

  // La raíz se ordena por `order` (el orden de `CATEGORY_ORDER`), no alfabético:
  // los permisos, que se buscan con urgencia, quedan arriba.
  const initialPath = initialCategory
    ? [...tree.folders.entries()].find(
        ([, folder]) => folder.category === initialCategory && folder.space === undefined,
      )?.[0]
    : undefined;

  // Estable a propósito: la librería vuelve a aplicar `panels` cada vez que la
  // referencia cambia, y la persona saltaría a la raíz con cada recarga de la lista.
  const panels = useMemo(
    () => [{ path: initialPath ?? '/', _sorts: { '/': { key: 'order', order: 'asc' as const } } }],
    // Sólo importa la carpeta inicial, no el árbol que la contiene.
    [initialCategory],
  );

  return (
    <div
      className={cn(
        // Claro como el área de contenido del panel, y con la misma sombra que el resto de las superficies.
        'luma-filemanager min-h-0 min-w-0 overflow-hidden rounded-lg bg-card shadow-surface [&_.wx-theme]:h-full',
        className,
      )}
    >
      <Willow fonts={false}>
        <Locale words={words} optional>
          <Filemanager
            data={tree.entities}
            readonly={!canWrite}
            mode="table"
            icons="simple"
            menuOptions={menuOptions}
            panels={panels}
            init={handleInit}
          />
        </Locale>
      </Willow>
      <DocumentPreview
        projectId={projectId}
        doc={documents.find((doc) => doc.id === previewId) ?? null}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
