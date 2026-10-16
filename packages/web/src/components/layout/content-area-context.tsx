import { createContext, useContext } from 'react';

/**
 * El nodo que envuelve al `main` del panel: lo que queda a la derecha del
 * sidebar y abajo del header.
 *
 * Existe para `FormPanel`, que tiene que tapar exactamente esa área y nada
 * más. Con `fixed` habría que saber cuánto mide el sidebar en cada pantalla;
 * montándose por portal adentro de este nodo, `absolute inset-0` alcanza.
 *
 * Es `null` en el primer render (el nodo todavía no existe) y fuera del
 * layout del panel. Quien lo usa tiene que tolerar las dos cosas.
 */
export const ContentAreaContext = createContext<HTMLElement | null>(null);

export function useContentArea(): HTMLElement | null {
  return useContext(ContentAreaContext);
}
