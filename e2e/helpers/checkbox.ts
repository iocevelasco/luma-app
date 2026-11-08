import type { Locator } from '@playwright/test';

/**
 * La parte clicable de una casilla.
 *
 * El `<input>` del Checkbox de HeroUI (React Aria) va dentro de un contenedor
 * de 1px recortado: se lee con `getByRole('checkbox')` y `toBeChecked()`, pero
 * Playwright no puede hacerle `click()` ni `check()` (nunca llega a ser
 * accionable). Quien lo toca es la persona: el cuadro, que es lo que devuelve
 * esto a partir del locator del input.
 */
export function tick(checkbox: Locator): Locator {
  return checkbox.locator(
    'xpath=ancestor::*[@data-slot="checkbox-content"][1]//*[@data-slot="checkbox-control"]',
  );
}
