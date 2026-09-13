import { Toaster } from '@/components/ui/sonner';
import { RouteErrorBoundary } from '@/components/error-boundary';
import { UpdateNotification } from '@/components/update-notification';
import { AppProvider } from '@/providers/app-provider';
import { AppRoutes } from '@/routes';

export function App() {
  return (
    <AppProvider>
      <RouteErrorBoundary>
        <AppRoutes />
      </RouteErrorBoundary>
      <Toaster />
      <UpdateNotification />
    </AppProvider>
  );
}

export default App;
