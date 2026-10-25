import 'react';

/**
 * React 19 tipa las etiquetas en `React.JSX`, no en el namespace global.
 * La interfaz es la que pide el widget.
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'nexus-chat': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
