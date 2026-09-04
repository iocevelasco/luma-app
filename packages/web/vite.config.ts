import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // `@luma/shared` es un paquete del workspace y se recompila junto con la
    // app. Pre-bundlearlo deja una copia congelada en .vite/deps que no se
    // regenera de forma confiable, y cualquier export nuevo revienta en
    // runtime hasta borrar la caché a mano.
    exclude: ['@luma/shared'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
