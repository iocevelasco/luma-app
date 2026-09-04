import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div>
          <p className="text-lg font-semibold">Algo se rompió</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Recargar</Button>
      </div>
    );
  }
}
