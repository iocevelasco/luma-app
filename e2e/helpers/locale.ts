/**
 * Idioma con el que corre la suite de Chromium.
 *
 * La app elige el idioma según el navegador: lo que no sea es-AR ni portugués
 * cae al español de España. Playwright usa en-US, así que sin fijarlo los specs
 * —que escriben el vocabulario argentino ("Agregar", "(vos)", "sumá",
 * "$ 100.000,00")— no encuentran sus textos.
 *
 * El locale tiene que llegar a cada lugar que abre un contexto de navegador:
 * - `playwright.config.ts` (`use.locale`): el contexto por defecto de cada test.
 * - `global-setup.ts`: el login que guarda la sesión. La app cachea el idioma
 *   que detectó en `localStorage` (`i18nextLng`), y ese valor le gana al
 *   navegador: una sesión guardada en en-US le daría es-ES a todo spec que la use.
 * - Cada `browser.newContext()` de un spec, que no hereda las opciones del proyecto.
 */
export const E2E_LOCALE = 'es-AR';
