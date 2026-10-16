import { defineConfig, devices } from '@playwright/test';
import { authFile } from './e2e/helpers/users';

// E2E_BASE_URL apunta la suite a un entorno remoto.
// Local: (default) http://localhost:6173
// Producción: E2E_BASE_URL=https://<DOMINIO>/app pnpm test:e2e
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:6173';
const IS_REMOTE = !/localhost/.test(BASE_URL);
const IS_CI     = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',

  // Nunca en paralelo en local: comparten estado en la base.
  fullyParallel: IS_CI,
  workers: IS_CI ? 1 : 1,

  // Sin reintentos: cada falla es una falla real, no un flake.
  retries: 0,

  forbidOnly: IS_CI,

  reporter: IS_CI
    ? 'github'
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    // Sesión por defecto: el admin de E2E. Un spec que necesita otra cuenta
    // la pide con `test.use({ storageState: authFile('supervisor') })` — el
    // globalSetup guarda una por cada usuario de `e2e/fixtures/users.json`.
    storageState: authFile('admin'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // Headless siempre. Correr headed en local abría una ventana por test y
    // hacía la suite mucho más lenta, además de robar el foco del teclado.
    // Para depurar visualmente: E2E_HEADED=1 pnpm test:e2e:ci  (o `pnpm test:e2e`,
    // que abre la UI de Playwright y no pasa por acá).
    headless: process.env.E2E_HEADED !== '1',
    // Timeouts holgados: un dev server lento no es una falla de la app.
    actionTimeout:    15_000,
    navigationTimeout: 20_000,
  },

  // Timeout por test: 30s en local, 60s en CI.
  timeout: IS_CI ? 60_000 : 30_000,

  // Sólo Chromium, en CI y a mano: no se testea en otros motores. Lo de Safari
  // se cuida al escribir el código (ver "Cross-browsing" en CLAUDE.md).
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Servidores de desarrollo — no se levantan si el target es remoto.
  webServer: IS_REMOTE ? [] : [
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:6173',
      reuseExistingServer: true, // siempre reusar: nunca matar y rearrancar a mitad de suite
      timeout: 120_000,
    },
    // La landing es un servicio aparte: cualquier test que arranque ahí falla
    // con ERR_CONNECTION_REFUSED —que parece un bug de la app— si este server
    // no está levantado.
    {
      command: 'pnpm dev:landing',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
