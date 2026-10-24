/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_BUILD_TIME?: string;
  /** Pisa el correo de contacto legal que viene de `@luma/shared`. */
  readonly VITE_LEGAL_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

