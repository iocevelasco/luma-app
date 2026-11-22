import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DriveIntegrationConfig } from '@luma/shared';
import { useIntegrationsConfig } from '@/hooks/integrations-config/use-integrations-config';
import { isGoogleDriveLoaded, pickerLocale, preloadGoogleDrive, requestDriveToken } from '@/lib/google-drive';
import { toast } from '@/lib/toast';

export interface DriveStart {
  config: DriveIntegrationConfig;
  tokenPromise: Promise<string>;
}

/**
 * Lo común a todo lo que habla con el Drive de la persona: si está disponible,
 * la precarga de los scripts y el pedido del permiso.
 *
 * El permiso se pide **sincrónico, dentro del clic** (`start`): el popup de Google
 * sólo se abre en el mismo gesto de la persona, y en Safari cualquier `await`
 * previo hace que el navegador lo bloquee. Por eso los scripts se precargan al montar.
 */
export function useDriveAccess() {
  const { t, i18n } = useTranslation();
  const { data: integrations } = useIntegrationsConfig();
  const drive: DriveIntegrationConfig | null = integrations?.drive ?? null;

  useEffect(() => {
    if (drive) void preloadGoogleDrive().catch(() => undefined);
  }, [drive]);

  /** Llamar desde el clic. `null` = no se puede ahora (sin Drive o sin scripts). */
  const start = useCallback((): DriveStart | null => {
    if (!drive) return null;
    if (!isGoogleDriveLoaded()) {
      toast.error(t('document.drive.errors.unavailable'));
      void preloadGoogleDrive().catch(() => undefined);
      return null;
    }
    const tokenPromise = requestDriveToken(drive.clientId);
    // Si la persona cierra el popup y nadie llegó a esperar la promesa, que no quede un rechazo suelto.
    tokenPromise.catch(() => undefined);
    return { config: drive, tokenPromise };
  }, [drive, t]);

  const pickOptions = useCallback(
    (config: DriveIntegrationConfig, token: string, title: string) => ({
      config,
      token,
      locale: pickerLocale(i18n.language),
      title,
    }),
    [i18n.language],
  );

  return { available: drive !== null, start, pickOptions };
}
