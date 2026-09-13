import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n/config';
import './index.css';

// El `basename` sale de BASE_URL: en producción la SPA se monta bajo /app, y
// sin esto todas las rutas del router quedarían fuera de ese subpath.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>
);

