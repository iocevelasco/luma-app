import { useTranslation } from 'react-i18next';
import sceneImg from '../assets/images/architect-latino-scene.webp';

/**
 * Escena de obra a ancho completo, con el texto de soporte sobre la parte
 * izquierda de la foto. El degradé oscuro va de ese lado para que el texto
 * tenga contraste sin importar la banda donde caiga la sección.
 */
export function Scene() {
  const { t } = useTranslation();

  return (
    <section className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <figure className="relative isolate overflow-hidden rounded-3xl border border-border shadow-surface">
          <img
            src={sceneImg}
            sizes="(min-width: 1152px) 1152px, calc(100vw - 48px)"
            width={1920}
            height={800}
            loading="lazy"
            decoding="async"
            alt={t('scene.alt')}
            className="aspect-[4/5] w-full object-cover object-[72%_50%] sm:aspect-[16/8] lg:aspect-[21/9]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-scrim via-scrim/60 to-transparent" />

          <figcaption className="absolute inset-0 flex max-w-xl flex-col justify-end p-8 sm:justify-center sm:p-12">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              {t('scene.label')}
            </p>
            <h2 className="mt-4 text-3xl leading-[1.1] tracking-tight text-on-scrim sm:text-5xl">
              {t('scene.title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-on-scrim/80 sm:text-lg">
              {t('scene.body')}
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
