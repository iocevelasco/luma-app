import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  type DocumentCategory,
  type DriveIntegrationConfig,
  type ProjectDocument,
} from '@luma/shared';
import { documentsApi } from '@/api/documents';
import { useDriveAccess } from '@/hooks/google-drive/use-drive-access';
import { errorMessage } from '@/lib/error-message';
import {
  DriveError,
  downloadDriveFile,
  pickExportFolder,
  pickFilesToImport,
  planImport,
  uploadToDrive,
} from '@/lib/google-drive';
import { QueryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';

/** Un error de Google tiene su propio texto; uno de la API pasa por `errorMessage`. */
export function driveErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof DriveError) return String(t(`document.drive.errors.${error.code}`));
  return errorMessage(error, t) ?? String(t('errors.internal'));
}

export interface DriveProgress {
  kind: 'import' | 'export';
  done: number;
  total: number;
}

interface ImportTarget {
  category: DocumentCategory;
  space?: string;
  /** El título con que entra cada archivo (la regla vive en el explorador). */
  titleFor: (fileName: string) => string;
}

/**
 * Capa 2 de Google Drive en la Documentación (ADR-005 §4).
 *
 * El permiso se pide dentro del clic (`importInto` / `exportDocuments` llaman a
 * `useDriveAccess().start` antes de la mutación): ver por qué en ese hook.
 */
export function useGoogleDrive(projectId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { available, start, pickOptions } = useDriveAccess();
  const [progress, setProgress] = useState<DriveProgress | null>(null);

  const importMutation = useMutation({
    mutationFn: async ({
      config,
      tokenPromise,
      target,
    }: {
      config: DriveIntegrationConfig;
      tokenPromise: Promise<string>;
      target: ImportTarget;
    }) => {
      const token = await tokenPromise;
      const picked = await pickFilesToImport(
        pickOptions(config, token, t('document.drive.importTitle')),
        DOCUMENT_MIME_TYPES,
      );
      if (!picked || picked.length === 0) return { imported: 0, failures: [] as unknown[] };

      const { accepted, rejected } = planImport(picked, {
        mimeTypes: DOCUMENT_MIME_TYPES,
        maxBytes: DOCUMENT_MAX_BYTES,
      });
      for (const { file, reason } of rejected) {
        toast.error(t(`document.drive.rejected.${reason}`, { name: file.name }));
      }

      const failures: unknown[] = [];
      setProgress({ kind: 'import', done: 0, total: accepted.length });
      for (const [index, file] of accepted.entries()) {
        try {
          const local = await downloadDriveFile(token, file, DOCUMENT_MAX_BYTES);
          await documentsApi.create(
            projectId,
            {
              category: target.category,
              space: target.space,
              title: target.titleFor(local.name),
              notes: undefined,
            },
            local,
          );
        } catch (error) {
          failures.push(error);
        }
        setProgress({ kind: 'import', done: index + 1, total: accepted.length });
      }
      return { imported: accepted.length - failures.length, failures };
    },
    onSuccess: ({ imported, failures }) => {
      if (imported > 0) toast.success(t('document.drive.imported', { count: imported }));
      if (failures.length > 0) toast.error(driveErrorMessage(failures[0], t));
    },
    onError: (error) => toast.error(driveErrorMessage(error, t)),
    onSettled: () => {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({
      config,
      tokenPromise,
      documents,
    }: {
      config: DriveIntegrationConfig;
      tokenPromise: Promise<string>;
      documents: ProjectDocument[];
    }) => {
      const token = await tokenPromise;
      const folderId = await pickExportFolder(
        pickOptions(config, token, t('document.drive.exportTitle')),
      );
      if (!folderId) return { exported: 0, link: undefined as string | undefined };

      setProgress({ kind: 'export', done: 0, total: documents.length });
      let link: string | undefined;
      for (const [index, doc] of documents.entries()) {
        const bytes = await documentsApi.file(projectId, doc.id);
        const uploaded = await uploadToDrive(
          token,
          new Blob([bytes], { type: doc.contentType }),
          { name: doc.fileName, folderId },
        );
        link = uploaded.webViewLink;
        setProgress({ kind: 'export', done: index + 1, total: documents.length });
      }
      return { exported: documents.length, link };
    },
    onSuccess: ({ exported, link }) => {
      if (exported === 0) return;
      toast.success(t('document.drive.exported', { count: exported }), {
        action: link
          ? {
              label: t('document.drive.openInDrive'),
              onClick: () => window.open(link, '_blank', 'noopener,noreferrer'),
            }
          : undefined,
      });
    },
    onError: (error) => toast.error(driveErrorMessage(error, t)),
    onSettled: () => setProgress(null),
  });

  const busy = progress !== null || importMutation.isPending || exportMutation.isPending;

  /** Llamar desde el clic: abre el permiso de Google en el mismo gesto. */
  const startToken = useCallback(() => (busy ? null : start()), [busy, start]);

  const importInto = useCallback(
    (target: ImportTarget) => {
      const started = startToken();
      if (started) importMutation.mutate({ ...started, target });
    },
    [startToken, importMutation],
  );

  const exportDocuments = useCallback(
    (documents: ProjectDocument[]) => {
      if (documents.length === 0) return;
      const started = startToken();
      if (started) exportMutation.mutate({ ...started, documents });
    },
    [startToken, exportMutation],
  );

  return { available, busy, progress, importInto, exportDocuments };
}
