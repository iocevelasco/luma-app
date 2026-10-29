/**
 * Version Manager
 * 
 * Gestiona la invalidación del localStorage cuando cambia la versión de la aplicación.
 * Cuando la versión aumenta, se limpia el localStorage pero se mantiene la sesión del usuario
 * (token y datos de usuario) para evitar que tenga que volver a iniciar sesión.
 */

import { RELEASE_SEEN_KEY } from './release-notes-storage';

const VERSION_STORAGE_KEY = 'app_version';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const SESSION_START_KEY = 'session_start_time';
const USER_STORAGE_KEY = 'user-storage'; // Zustand store
const THEME_STORAGE_KEY = 'vite-ui-theme'; // Theme preference
// Lo escribe i18next-browser-languagedetector (i18n/config.ts, `caches`). Si no
// se preserva, cada deploy le resetea el idioma a todo el mundo.
const LANGUAGE_STORAGE_KEY = 'i18nextLng';
// Qué novedades vio cada persona (`release-notes-storage.ts`). Es justo lo que
// un deploy tiene que respetar: el que trae la novedad es el que limpia el
// storage, y sin esta clave todos volverían a ver el punto después de verla.
const RELEASE_SEEN_STORAGE_KEY = RELEASE_SEEN_KEY;

/** Lo que sobrevive a una invalidación: la sesión y las preferencias de la persona. */
const PRESERVED_KEYS = [
  TOKEN_KEY,
  USER_KEY,
  SESSION_START_KEY,
  USER_STORAGE_KEY,
  THEME_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  RELEASE_SEEN_STORAGE_KEY,
] as const;

/**
 * Obtiene la versión actual de la aplicación desde las variables de entorno
 * inyectadas por Vite durante el build
 */
function getCurrentVersion(): string {
  return import.meta.env.VITE_APP_VERSION || '1.0.0';
}

/**
 * Obtiene la versión guardada en localStorage
 */
function getStoredVersion(): string | null {
  return localStorage.getItem(VERSION_STORAGE_KEY);
}

/**
 * Guarda la versión actual en localStorage
 */
function saveVersion(version: string): void {
  localStorage.setItem(VERSION_STORAGE_KEY, version);
}

/**
 * Limpia el localStorage pero preserva los datos de sesión del usuario
 * (token, usuario, tiempo de inicio de sesión, store de zustand) y sus
 * preferencias (tema, idioma)
 */
function clearLocalStoragePreservingSession(): void {
  const preserved = PRESERVED_KEYS.flatMap((key) => {
    const value = localStorage.getItem(key);
    return value === null ? [] : [[key, value] as const];
  });

  localStorage.clear();

  for (const [key, value] of preserved) {
    localStorage.setItem(key, value);
  }

  console.log('🧹 [VERSION] localStorage limpiado, sesión y preferencias preservadas');
}

/**
 * Verifica si la versión ha cambiado y limpia el localStorage si es necesario
 * 
 * @returns true si la versión cambió y se limpió el localStorage, false en caso contrario
 */
export function checkAndInvalidateOnVersionChange(): boolean {
  const currentVersion = getCurrentVersion();
  const storedVersion = getStoredVersion();

  // Si no hay versión guardada, es la primera vez que se ejecuta
  // Guardamos la versión actual y no limpiamos nada
  if (!storedVersion) {
    console.log(`📦 [VERSION] Primera ejecución, guardando versión: ${currentVersion}`);
    saveVersion(currentVersion);
    return false;
  }

  // Si la versión cambió, limpiamos el localStorage
  if (storedVersion !== currentVersion) {
    console.log(`🔄 [VERSION] Versión cambió de ${storedVersion} a ${currentVersion}`);
    console.log('🧹 [VERSION] Limpiando localStorage (preservando sesión)...');
    
    clearLocalStoragePreservingSession();
    saveVersion(currentVersion);
    
    return true;
  }

  // Versión no cambió, no hacer nada
  return false;
}

/**
 * Inicializa el sistema de gestión de versiones
 * Debe ser llamado al inicio de la aplicación
 */
export function initializeVersionManager(): void {
  checkAndInvalidateOnVersionChange();
}

