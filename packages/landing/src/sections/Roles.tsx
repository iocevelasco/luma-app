import Autoplay from 'embla-carousel-autoplay';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '../components/ui/carousel';
import { cn } from '../lib/utils';

/**
 * La grilla de permisos de la app, contada para quien la va a usar. Los
 * textos salen de packages/shared/src/permissions: si esa grilla cambia, esta
 * sección es la que hay que revisar.
 *
 * Carrusel de shadcn (Embla). Avanza solo cada 4 s, se pausa con el mouse
 * encima o con el foco adentro, y no arranca si el sistema pide menos
 * movimiento. Los controles de abajo muestran en qué rol se está.
 */
export function Roles() {
  const { t } = useTranslation();
  const items = t('roles.items', { returnObjects: true }) as {
    name: string;
    does: string;
    never: string;
    hook?: string;
  }[];

  const [autoplay] = useState(() =>
    Autoplay({
      delay: 4000,
      stopOnMouseEnter: true,
      stopOnFocusIn: true,
      stopOnInteraction: false,
    }),
  );
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  return (
    <section id="roles" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <Carousel
          setApi={setApi}
          opts={{ loop: true, align: 'start' }}
          plugins={reduceMotion ? [] : [autoplay]}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">{t('roles.label')}</p>
              <h2 className="mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
                {t('roles.title')}
              </h2>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t('roles.subtitle')}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <CarouselPrevious />
              <CarouselNext />
            </div>
          </div>

          <div className="mt-12">
            <CarouselContent>
              {items.map((role) => (
                <CarouselItem key={role.name} className="basis-[80%] sm:basis-1/3 lg:basis-1/4">
                  <article
                    className={cn(
                      'flex h-full flex-col rounded-none border border-border bg-background p-6 shadow-surface',
                      'transition duration-300 ease-out hover:-translate-y-1 hover:border-brand hover:shadow-raised',
                    )}
                  >
                    <h3 className="text-xl font-medium text-foreground">{role.name}</h3>
                    {role.hook && (
                      <p className="mt-3 text-base font-medium leading-snug text-foreground">
                        {role.hook}
                      </p>
                    )}

                    <p className="section-label mt-5">{t('roles.sees')}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {role.does}
                    </p>

                    <p className="section-label mt-5">{t('roles.never')}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {role.never}
                    </p>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
          </div>

          <div
            className="mt-8 flex justify-center gap-2"
            role="group"
            aria-label={t('roles.label')}
          >
            {items.map((role, index) => (
              <button
                key={role.name}
                type="button"
                aria-label={role.name}
                aria-current={index === selected}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === selected
                    ? 'w-8 bg-brand'
                    : 'w-1.5 bg-border-strong hover:bg-muted-foreground',
                )}
              />
            ))}
          </div>
        </Carousel>
      </div>
    </section>
  );
}
