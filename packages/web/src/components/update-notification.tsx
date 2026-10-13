import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useVersionCheck } from '@/hooks/use-version-check';

export function UpdateNotification() {
  const { t } = useTranslation();
  const { hasUpdate, currentVersion, newVersion, refresh } = useVersionCheck();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (hasUpdate && !toastShownRef.current) {
      toastShownRef.current = true;

      // Un deploy sin bump de semver deja la misma versión en los dos lados:
      // "ya está la versión 0.2.0" a alguien que tiene la 0.2.0 confunde. En ese
      // caso va el texto genérico.
      const versionChanged = newVersion !== null && newVersion !== currentVersion;

      toast(t('appUpdate.title'), {
        description: versionChanged
          ? t('appUpdate.bodyWithVersion', { version: newVersion })
          : t('appUpdate.body'),
        duration: Infinity,
        action: {
          label: t('appUpdate.action'),
          onClick: refresh,
        },
      });
    }
  }, [hasUpdate, currentVersion, newVersion, refresh, t]);

  return null;
}
