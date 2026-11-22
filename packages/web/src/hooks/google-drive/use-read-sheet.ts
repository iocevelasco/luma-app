import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { DriveIntegrationConfig } from '@luma/shared';
import { driveErrorMessage } from '@/hooks/documents/use-google-drive';
import { useDriveAccess } from '@/hooks/google-drive/use-drive-access';
import { pickSpreadsheet } from '@/lib/google-drive';
import { readSpreadsheet, type SheetCell } from '@/lib/google-sheets';
import { toast } from '@/lib/toast';

/** Lo que se leyó: el nombre de la planilla y sus celdas. */
export interface ReadSheet {
  name: string;
  values: SheetCell[][];
}

/**
 * Elegir una Google Sheet del Drive de la persona y leer su primera hoja. Es la
 * contracara de `useSaveAsSheet`: mismo permiso (`drive.file`, el archivo lo
 * elige la persona en el Picker) y mismos avisos.
 *
 * Una falla de Google va en toast: todavía no hay formulario detrás.
 */
export function useReadSheet(onRead: (sheet: ReadSheet) => void) {
  const { t } = useTranslation();
  const { available, start, pickOptions } = useDriveAccess();

  const mutation = useMutation({
    mutationFn: async ({
      config,
      tokenPromise,
    }: {
      config: DriveIntegrationConfig;
      tokenPromise: Promise<string>;
    }): Promise<ReadSheet | null> => {
      const token = await tokenPromise;
      const file = await pickSpreadsheet(pickOptions(config, token, t('material.import.pickTitle')));
      if (!file) return null;
      return { name: file.name, values: await readSpreadsheet(token, file.id) };
    },
    onSuccess: (sheet) => {
      if (sheet) onRead(sheet);
    },
    onError: (error) => toast.error(driveErrorMessage(error, t)),
  });

  const busy = mutation.isPending;

  /** Llamar desde el clic: abre el permiso de Google en el mismo gesto. */
  const read = useCallback(() => {
    if (busy) return;
    const started = start();
    if (started) mutation.mutate(started);
  }, [busy, start, mutation]);

  return { available, busy, read };
}
