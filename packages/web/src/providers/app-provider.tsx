import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';

/**
 * Composición de providers de la app.
 *
 * El QueryClient se crea una sola vez a nivel de módulo: dentro del componente
 * se recrearía en cada render y tiraría la caché entera. El orden importa —
 * AuthProvider necesita estar dentro del Router (lo monta main.tsx) y por fuera
 * de cualquier hook que lea la sesión.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="luma-ui-theme">
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
