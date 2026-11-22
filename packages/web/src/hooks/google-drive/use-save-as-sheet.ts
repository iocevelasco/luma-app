import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DriveIntegrationConfig } from '@luma/shared';
import { driveErrorMessage } from '@/hooks/documents/use-google-drive';
import { useDriveAccess } from '@/hooks/google-drive/use-drive-access';
import { pickExportFolder } from '@/lib/google-drive';
import { createSpreadsheet, type SheetTable } from '@/lib/google-sheets';
import { toast } from '@/lib/toast';

/** Lo que se guarda: el nombre del archivo y la tabla, armada recién después del clic. */
export interface SheetExport {
  name: string;
  table: SheetTable;
}

/**
 * "Guardar como Google Sheet" (ADR-005 §4): la misma pieza para todas las listas
 * que ya se bajan en CSV (Compras, Comprados, gastos y cobros). Quien la usa sólo
 * dice cómo armar la tabla; el permiso, la carpeta y el aviso viven acá.
 *
 * La tabla se arma con una función y no con un valor porque sus módulos se cargan
 * a demanda: el permiso de Google tiene que pedirse antes de cualquier `await`.
 */
export function useSaveAsSheet() {
  const { t } = useTranslation();
  const { available, start, pickOptions } = useDriveAccess();

  const mutation = useMutation({
    mutationFn: async ({
      config,
      tokenPromise,
      build,
    }: {
      config: DriveIntegrationConfig;
      tokenPromise: Promise<string>;
      build: () => Promise<SheetExport> | SheetExport;
    }) => {
      const token = await tokenPromise;
      const folderId = await pickExportFolder(pickOptions(config, token, t('drive.sheet.folderTitle')));
      if (!folderId) return null;
      const { name, table } = await build();
      return createSpreadsheet(token, { name, folderId, table });
    },
    onSuccess: (sheet) => {
      if (!sheet) return;
      const link = sheet.webViewLink;
      toast.success(t('drive.sheet.saved'), {
        action: link
          ? { label: t('drive.sheet.open'), onClick: () => window.open(link, '_blank', 'noopener,noreferrer') }
          : undefined,
      });
    },
    onError: (error) => toast.error(driveErrorMessage(error, t)),
  });

  const busy = mutation.isPending;

  /** Llamar desde el clic: abre el permiso de Google en el mismo gesto. */
  const save = useCallback(
    (build: () => Promise<SheetExport> | SheetExport) => {
      if (busy) return;
      const started = start();
      if (started) mutation.mutate({ ...started, build });
    },
    [busy, start, mutation],
  );

  return { available, busy, save };
}
