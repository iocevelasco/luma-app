import fs from 'node:fs';
import path from 'node:path';
import {
  chromium,
  request as playwrightRequest,
  type Browser,
  type FullConfig,
} from '@playwright/test';
import { authFile, canLogIn, e2eUsers, type E2EUser } from './helpers/users';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:6173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8081';

/**
 * Si la API responde. CI corre la tanda sin backend: ahí el login real no puede
 * funcionar, y sin esta pregunta el globalSetup tira y con él TODOS los tests,
 * incluidos los que no necesitan API. Se pregunta una vez, en vez de
 * descubrirlo con un timeout de 30s.
 */
async function apiIsUp(): Promise<boolean> {
  const ctx = await playwrightRequest.newContext();
  try {
    const res = await ctx.get(`${API_URL}/health`, { timeout: 5_000 });
    return res.ok();
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Estado de sesión vacío. `storageState` apunta a un archivo fijo: si no
 * existe, Playwright aborta antes de correr nada.
 */
function writeEmptyAuthState(outFile: string): void {
  fs.writeFileSync(outFile, JSON.stringify({ cookies: [], origins: [] }));
}

async function saveAuthState(browser: Browser, user: E2EUser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(user.password);
    await page.getByRole('button', { name: /entrar|ingresar|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    await context.storageState({ path: authFile(user.key) });
  } finally {
    await context.close();
  }
}

export default async function globalSetup(_config: FullConfig) {
  const authDir = path.join(process.cwd(), '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const allUsers = e2eUsers().filter(canLogIn);

  // Lo leen los specs con `requiresApi()` (helpers/api.ts). Playwright pasa
  // a los workers lo que el globalSetup deja en `process.env`.
  const apiUp = await apiIsUp();
  process.env.E2E_API_UP = apiUp ? '1' : '';

  if (!apiUp) {
    console.warn(`[global-setup] La API no responde en ${API_URL} — sólo corren los tests sin sesión`);
    allUsers.forEach((user) => writeEmptyAuthState(authFile(user.key)));
    return;
  }

  // Las cuentas por estado de la suscripción ya no las siembra nadie: se saltean.
  const skipped = allUsers.filter((user) => user.subscriptionDemo && !process.env.E2E_SUBSCRIPTION_DEMO);
  skipped.forEach((user) => writeEmptyAuthState(authFile(user.key)));
  const users = allUsers.filter((user) => !skipped.includes(user));

  // Una sesión guardada por cuenta, en paralelo: cada una en su contexto.
  const browser = await chromium.launch();
  const failed: string[] = [];
  try {
    await Promise.all(
      users.map(async (user) => {
        try {
          await saveAuthState(browser, user);
        } catch {
          failed.push(user.key);
          writeEmptyAuthState(authFile(user.key));
        }
      }),
    );
  } finally {
    await browser.close();
  }

  const saved = users.length - failed.length;
  console.log(`[global-setup] Sesiones guardadas: ${saved}/${users.length} ✓`);
  if (failed.length) {
    console.warn(
      `[global-setup] Falló el login de: ${failed.join(', ')} — los tests con esas sesiones van a fallar`,
    );
  }
}
