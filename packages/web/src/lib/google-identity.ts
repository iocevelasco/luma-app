/**
 * Entrar con Google desde el navegador (ADR-005 §1).
 *
 * El ID token sólo sale del botón que dibuja Google (`renderButton`, un
 * iframe): no hay forma de pedirlo desde un `Button` nuestro. La API verifica
 * el token; acá sólo se dibuja el botón y se entrega la credencial.
 *
 * Sin One Tap ni modo redirect: popup, y la contraseña como fallback. Si el
 * script no carga (sin red, un bloqueador, un navegador embebido), el botón no
 * se dibuja y la pantalla sigue andando con la contraseña.
 */

import { GSI_URL, loadGoogleScript } from './google-scripts';

interface CredentialResponse {
  credential?: string;
}

export interface GoogleButtonOptions {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  shape: 'rectangular';
  text: 'signin_with' | 'signup_with' | 'continue_with';
  logo_alignment: 'left';
  width: number;
  locale: string;
}

/** Lo que se usa de `google.accounts.id`. */
export interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode: 'popup';
    auto_select: boolean;
    cancel_on_tap_outside: boolean;
    context: 'signin' | 'signup' | 'use';
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
}

/** El ancho que acepta el botón de Google: fuera de esto lo recorta o lo ignora. */
export const GOOGLE_BUTTON_MIN_WIDTH = 200;
export const GOOGLE_BUTTON_MAX_WIDTH = 400;

const idReady = () => typeof window.google?.accounts?.id?.initialize === 'function';

/**
 * Carga el script **al montar la pantalla**, no en el clic: en Safari una
 * carga asíncrona entre el clic y el popup hace que el popup se bloquee.
 */
export function preloadGoogleIdentity(): Promise<void> {
  return loadGoogleScript(GSI_URL, idReady);
}

/**
 * `initialize` se llama una vez por client id: llamarlo de nuevo pisa la
 * configuración y Google lo avisa en consola. La pantalla que está montada
 * registra su handler acá, y el callback único se lo pasa.
 */
let initializedFor: string | null = null;
let currentHandler: ((credential: string) => void) | null = null;

export function setGoogleCredentialHandler(handler: ((credential: string) => void) | null): void {
  currentHandler = handler;
}

export function renderGoogleButton(
  clientId: string,
  parent: HTMLElement,
  options: Omit<GoogleButtonOptions, 'type' | 'theme' | 'size' | 'shape' | 'logo_alignment'>,
): boolean {
  const id = window.google?.accounts?.id;
  if (!id || typeof id.renderButton !== 'function') return false;

  if (initializedFor !== clientId) {
    id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) currentHandler?.(response.credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'use',
    });
    initializedFor = clientId;
  }

  // Volver a dibujar reemplaza el iframe: se vacía antes para no apilarlos.
  parent.replaceChildren();
  id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'rectangular',
    logo_alignment: 'left',
    ...options,
    width: clampButtonWidth(options.width),
  });
  return true;
}

export function clampButtonWidth(width: number): number {
  return Math.round(Math.min(GOOGLE_BUTTON_MAX_WIDTH, Math.max(GOOGLE_BUTTON_MIN_WIDTH, width)));
}

/** El idioma de la app en el formato del botón de Google. */
export function googleButtonLocale(language: string | undefined): string {
  if (!language) return 'es';
  if (language === 'es-AR') return 'es-419';
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es';
  return language;
}
