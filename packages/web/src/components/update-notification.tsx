import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useVersionCheck } from '@/hooks/use-version-check';

export function UpdateNotification() {
  const { hasUpdate, refresh } = useVersionCheck();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (hasUpdate && !toastShownRef.current) {
      toastShownRef.current = true;
      toast('Nueva versión disponible', {
        description: 'Recarga la página para obtener las últimas mejoras.',
        duration: Infinity,
        action: {
          label: 'Actualizar',
          onClick: refresh,
        },
      });
    }
  }, [hasUpdate, refresh]);

  return null;
}
