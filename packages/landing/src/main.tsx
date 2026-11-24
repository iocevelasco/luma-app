import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n/config';
import App from './App';
import { legacyLegalPath } from './lib/paths';

const legacy = legacyLegalPath(window.location.pathname);
if (legacy) {
  window.location.replace(`${legacy}${window.location.search}${window.location.hash}`);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
