import { Component, type ReactNode } from 'react';
import { Link2Off } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { MARKDOWN_PROSE_COMPACT } from '@/components/markdown/markdown-prose';
import { assessContent } from '@/lib/chat/content';
import { checkUrl } from '@/lib/chat/urls';
import { cn } from '@/lib/utils';
import { SafeImage } from './safe-image';

/**
 * Render de las respuestas del asistente: Markdown **no confiable**, igual en
 * streaming, al terminar y al restaurar el historial (es el mismo componente).
 *
 * Qué se hace y por qué:
 * - Sin `rehype-raw`: el HTML escrito no se interpreta. Un `<script>` o un
 *   `onerror` llega como texto. No se filtra con regex ni quitando etiquetas.
 * - `allowedElements` es una lista cerrada; el resto se desenvuelve a su texto.
 *   Sin iframes, formularios, estilos ni embebidos.
 * - Los componentes propios (`a`, `img`, `td`…) no reenvían los atributos que
 *   trae el Markdown: sólo los que se arman acá a partir de una URL validada.
 * - `urlTransform` rechaza lo que no pase `checkUrl`; los componentes vuelven a
 *   comprobarlo, así un componente nuevo no se salta la regla por descuido.
 *
 * Si algún día hace falta HTML, va con una biblioteca de sanitización
 * mantenida y una lista explícita de elementos y atributos, antes de insertar
 * nada en el DOM. No con `dangerouslySetInnerHTML` ni con regex.
 */
const ALLOWED_ELEMENTS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote', 'hr',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

function BlockedLink({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid="blocked-link"
      title={t('secureChat.blockedLink')}
      className="inline-flex items-center gap-1 text-muted-foreground line-through"
    >
      <Link2Off className="size-3 shrink-0" aria-hidden />
      {children}
      <span className="sr-only">{t('secureChat.blockedLink')}</span>
    </span>
  );
}

const COMPONENTS: Components = {
  a: ({ href, children }) => {
    const check = checkUrl(href, 'link');
    if (!check.ok) return <BlockedLink>{children}</BlockedLink>;
    return (
      <a href={check.url} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => (
    <SafeImage src={src} kind="remote-image" alt={typeof alt === 'string' ? alt : ''} zoomable />
  ),
  // El `className` (`language-html`) viene del texto; no se reenvía.
  code: ({ children }) => <code>{children}</code>,
  pre: ({ children }) => <pre>{children}</pre>,
  // `align` de las tablas GFM se convertiría en un `style`; no se reenvía.
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
};

function urlTransform(url: string, key: string): string {
  const purpose = key === 'src' ? 'remote-image' : 'link';
  const check = checkUrl(url, purpose);
  return check.ok ? check.url : '';
}

const PROSE = cn(
  MARKDOWN_PROSE_COMPACT,
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-secondary [&_pre]:p-3',
  '[&_code]:font-mono [&_code]:text-xs [&_pre_code]:whitespace-pre',
  '[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-secondary [&_:not(pre)>code]:px-1',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:bg-secondary [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_hr]:my-3 [&_hr]:border-border',
);

function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm">{text}</p>;
}

function RenderFailed({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <div role="alert" data-testid="render-failed" className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('secureChat.renderFailed')}</p>
      <PlainText text={text} />
    </div>
  );
}

/** Si el render revienta, queda el texto plano: seguro y recuperable. */
class RenderBoundary extends Component<
  { text: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { text: string }) {
    // Con más texto (streaming) se vuelve a intentar.
    if (this.state.failed && prev.text !== this.props.text) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? <RenderFailed text={this.props.text} /> : this.props.children;
  }
}

export function ChatMarkdown({ text, maxChars }: { text: unknown; maxChars: number }) {
  const { t } = useTranslation();
  const content = assessContent(text, maxChars);

  return (
    <div data-testid="chat-markdown">
      {content.mode === 'plain' ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">{t('secureChat.plainMode')}</p>
          <PlainText text={content.text} />
        </>
      ) : (
        <RenderBoundary text={content.text}>
          <div className={PROSE}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              allowedElements={ALLOWED_ELEMENTS}
              unwrapDisallowed
              components={COMPONENTS}
              urlTransform={urlTransform}
            >
              {content.text}
            </ReactMarkdown>
          </div>
        </RenderBoundary>
      )}
      {content.truncated && (
        <p className="mt-2 text-xs text-muted-foreground">{t('secureChat.truncated')}</p>
      )}
    </div>
  );
}
