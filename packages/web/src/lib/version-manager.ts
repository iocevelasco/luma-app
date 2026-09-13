/**
 * Version Manager
 * 
 * Gestiona la invalidación del localStorage cuando cambia la versión de la aplicación.
 * Cuando la versión aumenta, se limpia el localStorage pero se mantiene la sesión del usuario
 * (token y datos de usuario) para evitar que tenga que volver a iniciar sesión.
 */

const VERSION_STORAGE_KEY = 'app_version';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const SESSION_START_KEY = 'session_start_time';
const USER_STORAGE_KEY = 'user-storage'; // Zustand store
const THEME_STORAGE_KEY = 'vite-ui-theme'; // Theme preference

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
 * (token, usuario, tiempo de inicio de sesión, store de zustand y preferencias de tema)
 */
function clearLocalStoragePreservingSession(): void {
  // Guardar temporalmente los datos de sesión y preferencias del usuario
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  const sessionStart = localStorage.getItem(SESSION_START_KEY);
  const userStorage = localStorage.getItem(USER_STORAGE_KEY);
  const theme = localStorage.getItem(THEME_STORAGE_KEY);

  // Limpiar todo el localStorage
  localStorage.clear();

  // Restaurar los datos de sesión y preferencias
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(USER_KEY, user);
  }
  if (sessionStart) {
    localStorage.setItem(SESSION_START_KEY, sessionStart);
  }
  if (userStorage) {
    localStorage.setItem(USER_STORAGE_KEY, userStorage);
  }
  if (theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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

