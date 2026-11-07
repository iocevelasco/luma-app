import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useVersionCheck } from '@/hooks/use-version-check';

/** Cohete en el cielo verde de marca: es decorativo, el aviso lo dice el texto. */
function RocketArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 112"
      className="h-28 w-full"
      preserveAspectRatio="xMidYMax slice"
    >
      <circle cx="46" cy="30" r="2.5" fill="currentColor" opacity=".7" />
      <circle cx="268" cy="22" r="2" fill="currentColor" opacity=".7" />
      <circle cx="238" cy="62" r="3" fill="currentColor" opacity=".5" />
      <circle cx="84" cy="64" r="2" fill="currentColor" opacity=".5" />
      {/* estela */}
      <rect x="153" y="78" width="14" height="34" rx="7" fill="currentColor" opacity=".35" />
      {/* cuerpo */}
      <path
        d="M160 8c14 12 22 30 22 52v14h-44V60c0-22 8-40 22-52Z"
        fill="#fff"
      />
      <path d="M138 62l-14 18 14-2ZM182 62l14 18-14-2Z" fill="#fff" />
      <circle cx="160" cy="46" r="9" className="fill-primary" />
      {/* nubes */}
      <g fill="#fff" className="text-background">
        <circle cx="40" cy="116" r="30" opacity=".95" />
        <circle cx="86" cy="120" r="24" opacity=".9" />
        <circle cx="240" cy="120" r="26" opacity=".9" />
        <circle cx="286" cy="114" r="32" opacity=".95" />
      </g>
    </svg>
  );
}

/**
 * Aviso de que hay una versión nueva. Antes era un toast más, y se perdía entre
 * los de éxito y error: ahora es una tarjeta propia, arriba al centro y sobre
 * todo lo demás, con un solo botón grande que recarga. "Más tarde" la oculta
 * hasta la próxima recarga (el chequeo vuelve a avisar si sigue habiendo una nueva).
 */
export function UpdateBanner({
  version,
  onRefresh,
  onDismiss,
}: {
  /** La versión nueva, o `null` si no se puede nombrar (deploy sin bump de semver). */
  version: string | null;
  onRefresh: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={t('appUpdate.title')}
      data-testid="update-banner"
      className="surface-light fixed top-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-3xl bg-card text-card-foreground shadow-overlay animate-in fade-in-0 slide-in-from-top-4 duration-300 motion-reduce:animate-none"
    >
      <div className="relative bg-primary text-primary-foreground">
        <RocketArt />
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('appUpdate.dismiss')}
          className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md text-primary-foreground/80 transition-colors hover:bg-black/10 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
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
          <Button variant="ghost" size="sm" className="w-full" onClick={onDismiss}>
            {t('appUpdate.later')}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function UpdateNotification() {
  const { hasUpdate, currentVersion, newVersion, refresh } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!hasUpdate || dismissed) return null;

  // Un deploy sin bump de semver deja la misma versión en los dos lados:
  // "ya está la versión 0.2.0" a alguien que tiene la 0.2.0 confunde. En ese
  // caso va el texto genérico.
  const versionChanged = newVersion !== null && newVersion !== currentVersion;

  return (
    <UpdateBanner
      version={versionChanged ? newVersion : null}
      onRefresh={refresh}
      onDismiss={() => setDismissed(true)}
    />
  );
}
