import ReactMarkdown, { type Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { MARKDOWN_PROSE, MARKDOWN_PROSE_COMPACT } from './markdown-prose';

/**
 * Muestra el Markdown de una minuta.
 *
 * **Sin `rehype-raw`, a propósito.** El HTML que venga escrito se muestra como
 * texto y no se interpreta: si se interpretara, cualquiera que pueda crear un
 * hito le podría hacer correr un `<script>` al cliente que lo lee. Los links
 * con `javascript:` los limpia `react-markdown` por defecto.
 */
const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export function MarkdownView({
  children,
  compact = false,
  className,
}: {
  children: string;
  /** Adentro de una card: títulos al tamaño del cuerpo. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(compact ? MARKDOWN_PROSE_COMPACT : MARKDOWN_PROSE, className)}>
      <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>
    </div>
  );
}

export default MarkdownView;
