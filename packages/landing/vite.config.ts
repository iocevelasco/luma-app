import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** El build sigue en `/home`, pero `/legal/*` tiene que abrir la misma SPA. */
function legalRoutes(): Plugin {
  return {
    name: 'luma-legal-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '';
        const pathname = url.split('?')[0] ?? '';
        if (pathname === '/legal' || pathname.startsWith('/legal/')) {
          const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
          req.url = `/home/${query}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [legalRoutes(), react()],
  base: '/home',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../shared'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:6170',
        changeOrigin: true,
      },
    },
  },
});
