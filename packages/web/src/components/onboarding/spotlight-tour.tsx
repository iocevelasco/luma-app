import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Rocket, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TourStep {
  id: string;
  /** Selector CSS del elemento al que apunta. Sin él (o si no está a la vista) la tarjeta va al centro. */
  target?: string;
  icon: LucideIcon;
  title: string;
  body: string;
  /** Si viene, el último paso la muestra como botón principal en vez de "Siguiente". */
  cta?: { label: string; icon?: LucideIcon; onPress: () => void };
}

/** Aire entre el elemento marcado y su borde resaltado, y entre éste y la tarjeta. */
const PAD = 6;
const GAP = 14;
const MARGIN = 16;

/** El primer elemento que coincide y está a la vista (el riel y la barra de mobile comparten ids). */
function findTarget(selector?: string): DOMRect | null {
  if (!selector) return null;
  for (const element of document.querySelectorAll(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

/**
 * Recorrido con foco: oscurece la pantalla, deja a la vista el elemento del paso y
 * pone al lado una tarjeta que explica qué es. Mismo lenguaje que el aviso de versión
 * nueva (banda verde, título en serif, un botón grande).
 *
 * Es de una sola capa: quien lo usa decide los pasos y qué hacer al cerrar. Se cierra
 * con Escape, con "Omitir" o al terminar.
 */
export function SpotlightTour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ width: 320, height: 240 });
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = useCallback(() => {
    // Sólo se actualiza si el rectángulo cambió: `getBoundingClientRect` devuelve un objeto nuevo
    // cada vez, y guardarlo tal cual re-renderizaría el recorrido cada 300 ms sin motivo.
    const next = findTarget(step.target);
    setRect((prev) =>
      prev && next && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height
        ? prev
        : next,
    );
    const card = cardRef.current;
    if (card) {
      const { offsetWidth: width, offsetHeight: height } = card;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    }
  }, [step.target]);

  // El elemento puede montarse un instante después (llegan los datos) o moverse (resize).
  useLayoutEffect(measure, [measure, index]);
  useEffect(() => {
    const timer = window.setInterval(measure, 300);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = { left: (vw - size.width) / 2, top: (vh - size.height) / 2 };
  } else if (rect.left < vw * 0.3 && rect.width < vw * 0.4 && vw >= 768) {
    // El riel, a la izquierda: la tarjeta va a su derecha.
    cardStyle = {
      left: rect.right + PAD + GAP,
      top: clamp(rect.top + rect.height / 2 - size.height / 2, MARGIN, vh - size.height - MARGIN),
    };
  } else if (rect.top > vh / 2) {
    cardStyle = {
      left: clamp(rect.left + rect.width / 2 - size.width / 2, MARGIN, vw - size.width - MARGIN),
      top: Math.max(MARGIN, rect.top - PAD - GAP - size.height),
    };
  } else {
    cardStyle = {
      left: clamp(rect.left + rect.width / 2 - size.width / 2, MARGIN, vw - size.width - MARGIN),
      top: Math.min(vh - size.height - MARGIN, rect.bottom + PAD + GAP),
    };
  }

  const Icon = step.cta ? Rocket : step.icon;
  const CtaIcon = step.cta?.icon;

  return (
    <div className="fixed inset-0 z-[80]" data-testid="onboarding-tour">
      {/* Captura los clics: mientras dura el recorrido la pantalla de atrás no se toca. */}
      <div className={cn('absolute inset-0', !rect && 'bg-backdrop')} aria-hidden="true" />
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary shadow-[0_0_0_9999px_var(--backdrop)] transition-all duration-200 motion-reduce:transition-none"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-label={step.title}
        className="surface-light absolute w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl bg-card text-card-foreground shadow-overlay"
        style={cardStyle}
      >
        <div className="flex h-16 items-center justify-center bg-primary text-primary-foreground" aria-hidden="true">
          <span className="flex size-10 items-center justify-center rounded-xl bg-background/30">
            <Icon className="size-5" />
          </span>
        </div>

        <div className="flex flex-col items-center gap-3 px-5 pt-4 pb-5 text-center">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-xl leading-tight">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>

          <ol
            aria-label={t('tour.stepOf', { current: index + 1, total: steps.length })}
            className="flex items-center gap-1.5"
          >
            {steps.map((s, i) => (
              <li
                key={s.id}
                aria-hidden="true"
                className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border')}
              />
            ))}
          </ol>

          <div className="flex w-full flex-col gap-2">
            {isLast && step.cta ? (
              <>
                <Button ref={nextRef} size="lg" className="w-full" onClick={step.cta.onPress} data-testid="tour-cta">
                  {CtaIcon && <CtaIcon className="size-4" />}
                  {step.cta.label}
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
                  {t('tour.later')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  ref={nextRef}
                  size="lg"
                  className="w-full"
                  onClick={() => (isLast ? onClose() : setIndex(index + 1))}
                  data-testid="tour-next"
                >
                  {isLast ? t('tour.done') : t('tour.next')}
                </Button>
                <div className="flex w-full items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
                    {t('tour.back')}
                  </Button>
                  {!isLast && (
                    <Button variant="ghost" size="sm" onClick={onClose}>
                      {t('tour.skip')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
