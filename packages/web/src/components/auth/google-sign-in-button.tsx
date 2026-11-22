import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  googleButtonLocale,
  preloadGoogleIdentity,
  renderGoogleButton,
  setGoogleCredentialHandler,
} from '@/lib/google-identity';
import { cn } from '@/lib/utils';

interface GoogleSignInButtonProps {
  clientId: string;
  /** Qué dice el botón. Los textos son los fijos de Google, traducidos por él. */
  text: 'signin_with' | 'signup_with' | 'continue_with';
  onCredential: (credential: string) => void;
  /** Mientras se verifica una credencial, el botón no recibe otro clic. */
  disabled?: boolean;
  className?: string;
}

/**
 * El botón de Google, dibujado por Google (excepción explícita en DESIGN.md):
 * es un iframe, no acepta nuestras clases ni nuestro `Button`. Tema `outline`,
 * rectangular, alto `large`, y el ancho de la columna (200 a 400 px), que se
 * vuelve a medir al cambiar el tamaño o el idioma.
 *
 * Si el script no carga no se dibuja nada: queda la contraseña.
 */
export function GoogleSignInButton({
  clientId,
  text,
  onCredential,
  disabled = false,
  className,
}: GoogleSignInButtonProps) {
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);

  // El handler más reciente, sin volver a dibujar el botón cada render.
  const handlerRef = useRef(onCredential);
  handlerRef.current = onCredential;

  useEffect(() => {
    let alive = true;
    preloadGoogleIdentity()
      .then(() => alive && setReady(true))
      .catch(() => alive && setReady(false));
    setGoogleCredentialHandler((credential) => handlerRef.current(credential));
    return () => {
      alive = false;
      setGoogleCredentialHandler(null);
    };
  }, []);

  // Ancho de la columna. `ResizeObserver` existe en Safari desde 13.1; sin él,
  // se mide una vez y alcanza.
  useEffect(() => {
    const node = containerRef.current?.parentElement;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    if (typeof window.ResizeObserver !== 'function') return;
    const observer = new window.ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const locale = googleButtonLocale(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    const node = containerRef.current;
    if (!ready || !node || width === 0) return;
    renderGoogleButton(clientId, node, { text, width, locale });
  }, [ready, clientId, text, width, locale]);

  return (
    <div
      ref={containerRef}
      // El iframe de Google mide 44 px en `large`: reservarlo evita el salto al cargar.
      className={cn(
        'flex min-h-11 w-full justify-center',
        disabled && 'pointer-events-none opacity-60',
        !ready && 'hidden',
        className,
      )}
      aria-busy={disabled || undefined}
    />
  );
}
