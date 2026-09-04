import { AppProvider } from '@/providers/app-provider';
import { AppRoutes } from '@/routes';
import { ErrorBoundary } from '@/components/error-boundary';

export default function App() {
  return (
    <AppProvider>
      {/* Última red: sin esto, una excepción de render desmonta la app y deja
          el fondo del body a la vista, sin mensaje ni forma de volver. */}
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AppProvider>
  );
}
