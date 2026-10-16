import { test } from '@playwright/test';

/**
 * Para los specs que necesitan la API: registran cuentas, inician sesión,
 * crean obras. Se llama una vez, arriba del `test.describe`.
 *
 * CI corre la suite sin backend. Sin esto esos specs no se salteaban: corrían
 * igual y fallaban esperando un login que no puede pasar, y el rojo tapaba
 * cualquier falla real de los que sí corren sin sesión.
 *
 * El dato lo deja `global-setup.ts` en `E2E_API_UP`, después de preguntarle a
 * `/health` una sola vez.
 */
export function requiresApi() {
  test.skip(process.env.E2E_API_UP !== '1', 'La API no responde: este flujo necesita sesión');
}
