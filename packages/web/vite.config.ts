import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Leer la versión del package.json
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));
const appVersion = packageJson.version;

// Un solo lugar arma el payload: si el del build y el de dev se separan, el
// hook se prueba en dev contra una forma que en producción no existe.
function buildVersionPayload(version = appVersion) {
  return { version, buildTime: new Date().toISOString() };
}

// Plugin para generar version.json — en el build como archivo, en dev servido
// por un middleware.
function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',

    // En dev no hay `writeBundle`, así que sin esto `/version.json` no matchea
    // ningún archivo y cae en el fallback SPA: index.html con 200 OK y
    // Content-Type text/html. useVersionCheck lo descarta por content-type, pero
    // entonces el chequeo de versión no se puede probar en local.
    //
    // Va en el cuerpo de configureServer y no en la función que devuelve: así se
    // registra ANTES de los middlewares internos de Vite y le gana al fallback.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (!pathname.endsWith('/version.json')) return next();

        // Lever para probar el toast de actualización sin buildear: el cliente se
        // compila con la versión de package.json, así que
        // `DEV_VERSION_OVERRIDE=9.9.9 pnpm dev:web` le hace ver una versión nueva.
        const payload = buildVersionPayload(process.env.DEV_VERSION_OVERRIDE || appVersion);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(payload));
      });
    },

    writeBundle(options) {
      const outDir = options.dir || 'dist';
      writeFileSync(
        path.resolve(__dirname, outDir, 'version.json'),
        JSON.stringify(buildVersionPayload(), null, 2)
      );
      console.log(`✓ Generated version.json (v${appVersion})`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [react(), versionPlugin()],
  // En producción la SPA se sirve bajo /app (la API la monta ahí); en dev, desde
  // la raíz. El router usa este mismo valor como basename, vía BASE_URL.
  base: process.env.NODE_ENV === 'production' ? '/app/' : '/',
  define: {
    // Inyectar la versión de la app como variable de entorno
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // `shared` es un paquete del workspace, no una dependencia externa: se
    // recompila junto con la app. Pre-bundlearlo (include) deja una copia
    // congelada en .vite/deps que no se regenera de forma confiable, y
    // cualquier export nuevo revienta en runtime con "does not provide an
    // export named X" hasta borrar la caché a mano. Excluirlo hace que Vite lo
    // resuelva siempre desde su dist actual.
    exclude: ['@luma/shared'],
  },
  server: {
    port: 5173,
    warmup: {
      clientFiles: ['./src/main.tsx', './src/pages/*.tsx'],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));

