import fs from 'node:fs';
import path from 'node:path';
import { chromium, request as playwrightRequest, type FullConfig } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@luma.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin1234!';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

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
 * Estado de sesión vacío. `use.storageState` apunta a un archivo fijo: si no
 * existe, Playwright aborta antes de correr nada.
 */
function writeEmptyAuthState(outFile: string): void {
  fs.writeFileSync(outFile, JSON.stringify({ cookies: [], origins: [] }));
}

async function saveAuthState(email: string, password: string, outFile: string): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /entrar|ingresar|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    await page.context().storageState({ path: outFile });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig) {
  const authDir = path.join(process.cwd(), '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const adminFile = path.join(authDir, 'admin.json');

  if (!(await apiIsUp())) {
    console.warn(`[global-setup] La API no responde en ${API_URL} — sólo corren los tests sin sesión`);
    writeEmptyAuthState(adminFile);
    return;
  }

  try {
    await saveAuthState(ADMIN_EMAIL, ADMIN_PASSWORD, adminFile);
    console.log('[global-setup] Sesión de admin guardada ✓');
  } catch {
    console.warn('[global-setup] Falló el login de admin — los tests con sesión van a fallar');
    writeEmptyAuthState(adminFile);
  }
}
