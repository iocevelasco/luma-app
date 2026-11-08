import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RocketArt } from '@/components/common/rocket-art';
import { Button } from '@/components/ui/button';
import { useVersionCheck } from '@/hooks/use-version-check';

/**
 * Aviso de que hay una versión nueva. Antes era un toast más, y se perdía entre
 * los de éxito y error: ahora es una tarjeta propia, arriba al centro y sobre
 * todo lo demás, con un solo botón grande que recarga. No se puede omitir: una
 * pestaña con una versión vieja contra una API nueva termina en errores raros, así
 * que el aviso se queda hasta que la persona actualiza. Queda debajo del header, que
 * sigue a mano (cuenta, notificaciones). Única salida: si ya se actualizó una vez y el
 * aviso volvió, se ofrece "seguir sin actualizar" para no encerrarla en un bucle.
 */
export function UpdateBanner({
  version,
  onRefresh,
  onContinue,
}: {
  /** La versión nueva, o `null` si no se puede nombrar (deploy sin bump de semver). */
  version: string | null;
  onRefresh: () => void;
  /**
   * La salida de último recurso: sólo se ofrece cuando ya se intentó actualizar y el aviso
   * volvió (caché o deploy a medias). Sin ella la persona quedaría en un bucle de recargas.
   */
  onContinue?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={t('appUpdate.title')}
      data-testid="update-banner"
      className="surface-light fixed top-[4.5rem] left-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-3xl bg-card text-card-foreground shadow-overlay animate-in fade-in-0 slide-in-from-top-4 duration-300 motion-reduce:animate-none"
    >
      <div className="relative bg-primary text-primary-foreground">
        <RocketArt />
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pt-5 pb-6 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-2xl leading-tight">{t('appUpdate.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {version ? t('appUpdate.bodyWithVersion', { version }) : t('appUpdate.body')}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" className="w-full" onClick={onRefresh} data-testid="update-banner-action">
            {t('appUpdate.action')}
          </Button>
          {onContinue && (
            <Button variant="ghost" size="sm" className="w-full" onClick={onContinue} data-testid="update-banner-continue">
              {t('appUpdate.continue')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

const TRIED_KEY = 'luma.update.tried';

// Sin `sessionStorage` (modo privado) no se puede saber si ya se intentó: se asume que no.
function alreadyTried(target: string): boolean {
  try {
    return window.sessionStorage.getItem(TRIED_KEY) === target;
  } catch {
    return false;
  }
}

function markTried(target: string) {
  try {
    window.sessionStorage.setItem(TRIED_KEY, target);
  } catch {
    /* sin almacenamiento: no hay bucle que cortar */
  }
}

export function UpdateNotification() {
  const { hasUpdate, currentVersion, newVersion, refresh } = useVersionCheck();
  const [continued, setContinued] = useState(false);

  if (!hasUpdate || continued) return null;

  // Un deploy sin bump de semver deja la misma versión en los dos lados:
  // "ya está la versión 0.2.0" a alguien que tiene la 0.2.0 confunde. En ese
  // caso va el texto genérico.
  const versionChanged = newVersion !== null && newVersion !== currentVersion;
  const target = newVersion ?? 'build';

  return (
    <UpdateBanner
      version={versionChanged ? newVersion : null}
      onRefresh={() => {
        markTried(target);
        refresh();
      }}
      onContinue={alreadyTried(target) ? () => setContinued(true) : undefined}
    />
  );
}
