import { useLayoutEffect } from 'react';

type Theme = 'light' | 'dark';

/**
 * Fija el tema mientras un área de la app esté montada, y lo devuelve al salir.
 *
 * `areaClass` permite además que el área redefina tokens propios en index.css
 * sin tocar los del resto de la app.
 *
 * Actúa sobre `document.documentElement` y no sobre un wrapper por una razón
 * concreta: los diálogos, drawers, selects, dropdowns y los toasts de sonner
 * montan en portales colgados de `document.body`. Un `<div className="light">`
 * en el árbol de React no los envuelve, así que resolverían los tokens de
 * `.dark` y saldrían oscuros sobre una pantalla clara.
 *
 * Tampoco usa `setTheme()` de next-themes: eso persiste en localStorage
 * (`luma-ui-theme`) y le cambiaría el tema a quien abra sesión después en el
 * mismo navegador. Acá la clase se manipula directo y next-themes queda
 * intacto, con su preferencia guardada sin tocar.
 *
 * El cleanup restaura lo que **había**, leído en el mount, en vez de asumir
 * `dark`: el área scopeada no es necesariamente la única del árbol.
 */
export function useScopedTheme(theme: Theme, areaClass?: string) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = Array.from(root.classList).filter((c) => c === 'light' || c === 'dark');

    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    if (areaClass) root.classList.add(areaClass);

    return () => {
      root.classList.remove('light', 'dark');
      root.classList.add(...previous);
      if (areaClass) root.classList.remove(areaClass);
    };
  }, [theme, areaClass]);
}
