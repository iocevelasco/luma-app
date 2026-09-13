import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { RouteError } from '@/components/routes/route-error';

/**
 * Contiene los errores de render para que no se lleven puesta la app entera.
 *
 * Sin esto, cualquier excepción en cualquier punto del árbol desmonta React y
 * deja el `<div id="root">` vacío. Lo único que queda a la vista es el fondo
 * del `<body>` —negro con el tema oscuro—, sin mensaje, sin stack y sin nada
 * que tocar. Es el reporte de "pantalla negra al escanear el QR": no era una
 * pantalla de la app, era la ausencia de la app.
 *
 * `RouteError` ya existía escrito para esto y no estaba montado en ningún
 * lado: nunca hubo boundary que lo renderizara.
 *
 * React sólo permite capturar errores desde una clase — no hay equivalente en
 * hooks —, así que esta parte no puede ser un componente de función.
 */
interface Props {
  children: ReactNode;
  /** Al cambiar, se limpia el error. Sirve para reintentar al navegar. */
  resetKey?: string;
  /** Etiqueta para distinguir en consola qué boundary saltó. */
  label?: string;
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
    // El stack de componentes es lo que dice DÓNDE se rompió; el mensaje solo
    // dice qué. Sin esto habría que adivinar entre todo el árbol.
    console.error(
      `[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prev: Props) {
    // Reintento implícito: si el usuario navega a otra ruta, la pantalla de
    // error no debería quedar pegada. Se limpia por `resetKey` y no por
    // `key` en el padre, que remontaría los hijos en cada navegación y les
    // haría perder el estado.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <RouteError
          error={this.state.error}
          resetErrorBoundary={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * `ErrorBoundary` que se limpia solo al cambiar de ruta.
 *
 * Tiene que estar adentro del `BrowserRouter`: usa `useLocation`, y el propio
 * `RouteError` usa `useNavigate` para el botón de volver.
 */
export function RouteErrorBoundary({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} label={label}>
      {children}
    </ErrorBoundary>
  );
}
