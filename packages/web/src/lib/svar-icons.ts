import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createElement, type ComponentType } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clipboard,
  Clock,
  Columns2,
  Copy,
  Download,
  EllipsisVertical,
  Eye,
  FilePlus,
  FileUp,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Pencil,
  Scissors,
  Search,
  X,
} from 'lucide-react';

/**
 * `@svar-ui/react-filemanager` dibuja sus íconos con una fuente (`wxi-*`) que
 * `Willow` baja de `cdn.svar.dev` — y la dejamos apagada (`fonts={false}`) para
 * no depender de un CDN de terceros. Sin fuente, la barra y el menú quedan en
 * blanco. Acá cada clase de la librería se mapea a un ícono de Lucide, el único
 * set del proyecto, pintado con `mask` para que tome `currentColor`.
 *
 * La hoja es global a propósito: los menús y los modales de la librería se
 * dibujan en un portal fuera del componente, y el Cronograma y el Tablero usan
 * las mismas clases. Por eso la importan los tres (`import '@/lib/svar-icons'`):
 * si sólo la cargara uno, los demás cambiarían de aspecto según la navegación.
 */
const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'wxi-close': X,
  'wxi-angle-right': ChevronRight,
  'wxi-angle-down': ChevronDown,
  'wxi-angle-left': ChevronLeft,
  'wxi-angle-dbl-right': ChevronsRight,
  'wxi-angle-dbl-left': ChevronsLeft,
  'wxi-dots-v': EllipsisVertical,
  'wxi-eye': Eye,
  'wxi-content-paste': Clipboard,
  'wxi-content-cut': Scissors,
  'wxi-content-copy': Copy,
  'wxi-calendar': Calendar,
  'wxi-arrow-left': ArrowLeft,
  'wxi-view-sequential': List,
  'wxi-view-grid': LayoutGrid,
  'wxi-view-column': Columns2,
  'wxi-search': Search,
  'wxi-folder': Folder,
  'wxi-edit': Pencil,
  'wxi-download': Download,
  'wxi-clock': Clock,
  'mdi-folder-plus-outline': FolderPlus,
  'mdi-file-plus-outline': FilePlus,
  'mdi-file-upload-outline': FileUp,
};

const STYLE_ID = 'luma-svar-icons';

/** El SVG de un componente de Lucide, tal cual lo pinta React. */
function svgOf(Icon: ComponentType<{ size?: number; strokeWidth?: number }>): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(createElement(Icon, { size: 24, strokeWidth: 2 })));
  const markup = host.innerHTML.replace('currentColor', '#000');
  root.unmount();
  return markup;
}

/** Idempotente: arma la hoja una sola vez. */
export function installSvarIcons(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;

  const rules = Object.entries(ICONS).map(([name, Icon]) => {
    const url = `url("data:image/svg+xml,${encodeURIComponent(svgOf(Icon))}")`;
    return (
      `.${name}::before{content:"";display:inline-block;width:1em;height:1em;` +
      `vertical-align:-0.125em;background-color:currentColor;` +
      `-webkit-mask:${url} center/contain no-repeat;mask:${url} center/contain no-repeat}`
    );
  });

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

// Una vez, al cargar el módulo y fuera del render: `flushSync` no puede correr dentro de uno.
if (typeof window !== 'undefined') window.setTimeout(installSvarIcons, 0);
