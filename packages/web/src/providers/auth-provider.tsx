import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthResponse } from '@luma/shared';
import { useUserStore } from '@/stores/user-store';
import { isTokenExpired, getTokenExpirationTime } from '@/lib/jwt-utils';
import { initializeVersionManager } from '@/lib/version-manager';
import { apiClient } from '@/lib/api-client';
import { ROUTES } from '@/lib/routes';

interface AuthContextValue {
  user: AuthResponse['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthResponse['user']) => void;
  logout: () => void;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const SESSION_START_KEY = 'session_start_time';

// Session duration: 1 month in milliseconds
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check if session is still valid
   * Session is invalid if:
   * 1. Token is expired (JWT exp claim)
   * 2. More than 1 month has passed since session start
   */
  const checkSessionValidity = useCallback((currentToken: string): boolean => {
    // Check if JWT token itself is expired
    if (isTokenExpired(currentToken)) {
      console.log('🔒 [AUTH] Session expired: JWT token expired');
      return false;
    }

    // Check if 1 month has passed since session start
    const sessionStartTime = localStorage.getItem(SESSION_START_KEY);
    if (sessionStartTime) {
      const startTime = parseInt(sessionStartTime, 10);
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= SESSION_DURATION) {
        console.log('🔒 [AUTH] Session expired: 1 month duration exceeded');
        return false;
      }
    } else {
      // If no session start time, check token expiration time
      // Use token expiration as fallback, but limit to 1 month max
      const tokenExpiration = getTokenExpirationTime(currentToken);
      if (tokenExpiration) {
        const now = Date.now();
        const tokenAge = tokenExpiration - now;
        
        // If token expires in more than 1 month, consider session invalid
        // Otherwise, use token expiration as session end
        if (tokenAge > SESSION_DURATION) {
          console.log('🔒 [AUTH] Session expired: Token expiration exceeds 1 month limit');
          return false;
        }
      }
    }

    return true;
  }, []);

  /**
   * ¿Se pasó del tope duro de sesión (30 días desde el login)?
   *
   * Se chequea aparte del JWT: renovar el access token no debe poder estirar
   * una sesión indefinidamente. Vencido el tope, se vuelve a pedir contraseña.
   */
  const hasExceededSessionCap = useCallback((): boolean => {
    const sessionStartTime = localStorage.getItem(SESSION_START_KEY);
    if (!sessionStartTime) return false;
    return Date.now() - parseInt(sessionStartTime, 10) >= SESSION_DURATION;
  }, []);

  /**
   * Clear session and logout
   */
  const clearSession = useCallback(() => {
    setTokenState(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_START_KEY);
    useUserStore.getState().clearUser();
    
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
  }, []);

  /**
   * Setup periodic session check
   */
  const setupSessionCheck = useCallback((_currentToken: string) => {
    // Clear any existing interval
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }

    // Check session validity every 5 minutes
    sessionCheckIntervalRef.current = setInterval(() => {
      void (async () => {
        const storedToken = localStorage.getItem(TOKEN_KEY);

        if (storedToken && checkSessionValidity(storedToken)) return;

        // El token venció, pero la cookie de refresh dura 90 días: renovarlo
        // antes de desloguear. Este chequeo corre cada 5 minutos y llegaba al
        // vencimiento antes que cualquier request, así que era él —y no el 401—
        // el que echaba al usuario a los 7 días.
        if (storedToken && !hasExceededSessionCap()) {
          const refreshed = await apiClient.refreshSession();
          if (refreshed) {
            setTokenState(refreshed);
            return;
          }
        }

        console.log('🔒 [AUTH] Session expired, logging out...');
        clearSession();
        navigate(ROUTES.LOGIN);
      })();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }, [checkSessionValidity, clearSession, hasExceededSessionCap, navigate]);

  // Load auth state from localStorage on mount
  useEffect(() => {
    // Verificar y limpiar localStorage si la versión cambió
    // Esto debe ejecutarse antes de cargar el estado de autenticación
    initializeVersionManager();

    let cancelled = false;

    const restore = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedToken || !storedUser) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        let activeToken: string | null = checkSessionValidity(storedToken)
          ? storedToken
          : null;

        // El caso típico: la persona vuelve a abrir la app
        // días después, el access token ya venció y —sin renovación— la sesión
        // se cerraba acá mismo, antes de pintar nada.
        if (!activeToken && !hasExceededSessionCap()) {
          activeToken = await apiClient.refreshSession();
        }

        if (cancelled) return;

        if (!activeToken) {
          console.log('🔒 [AUTH] Stored session expired, clearing...');
          clearSession();
          setIsLoading(false);
          return;
        }

        setTokenState(activeToken);
        setUser(parsedUser);

        // Ensure session start time is set
        if (!localStorage.getItem(SESSION_START_KEY)) {
          localStorage.setItem(SESSION_START_KEY, Date.now().toString());
        }

        // Setup periodic session check
        setupSessionCheck(activeToken);
      } catch (error) {
        console.error('Error loading auth state:', error);
        if (!cancelled) clearSession();
      }

      if (!cancelled) setIsLoading(false);
    };

    void restore();

    // Cleanup interval on unmount
    return () => {
      cancelled = true;
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [checkSessionValidity, clearSession, hasExceededSessionCap, setupSessionCheck]);

  /**
   * Conectar el api-client con el provider.
   *
   * Sin esto el cliente cierra sesión con `window.location.href`: recarga el
   * documento entero y deja el estado de React desincronizado un instante
   * antes. Con esto navega por el router y el token renovado por atrás llega
   * al árbol sin recargar nada.
   */
  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      clearSession();
      navigate(ROUTES.LOGIN);
    });
    apiClient.setTokenRefreshedHandler((newToken) => {
      setTokenState(newToken);
    });

    return () => {
      apiClient.setUnauthorizedHandler(null);
      apiClient.setTokenRefreshedHandler(null);
    };
  }, [clearSession, navigate]);

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const login = (newToken: string, newUser: AuthResponse['user']) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    
    // Set session start time
    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    
    // Setup periodic session check
    setupSessionCheck(newToken);
    
    // Also update user store
    useUserStore.getState().setUser(newUser);
  };

  const logout = () => {
    clearSession();
    navigate(ROUTES.LOGIN);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

