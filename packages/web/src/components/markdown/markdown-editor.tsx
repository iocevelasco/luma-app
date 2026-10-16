import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { MARKDOWN_PROSE } from './markdown-prose';

/**
 * Editor de minutas. Guarda y devuelve **Markdown**, no HTML ni el JSON de
 * Tiptap: es lo que se lee con `MarkdownView` y lo que entiende cualquier otra
 * herramienta el día que haya que exportar.
 *
 * La barra tiene lo justo para una minuta —título, subtítulo, negrita,
 * itálica, listas y enlace— y nada que el Markdown no pueda guardar: sin
 * subrayado, colores ni tablas. Las imágenes van como adjunto, no en el texto.
 *
 * Se carga con `React.lazy`: Tiptap y ProseMirror pesan, y sólo hacen falta
 * en el formulario. Leer una minuta no los necesita.
 */
interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /**
   * El `id` del `<Label>`. Hace falta: `<label for>` sólo nombra inputs y
   * textareas, no un `contenteditable`, y sin esto el lector de pantalla
   * anuncia "cuadro de texto" a secas.
   */
  labelledBy?: string;
  /** Para el `aria-describedby` del mensaje de error. */
  describedBy?: string;
}

export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  labelledBy,
  describedBy,
}: MarkdownEditorProps) {
  // El placeholder cambia con el tipo de hito ("Minuta" en una reunión), pero
  // Tiptap lo lee una sola vez al crear el editor: se le pasa una función que
  // lee siempre el último valor, y se fuerza un repintado cuando cambia.
  const placeholderRef = useRef(placeholder ?? '');
  placeholderRef.current = placeholder ?? '';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Lo que el Markdown de una minuta no necesita o no sabe guardar.
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Markdown,
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
    ],
    content: value,
    contentType: 'markdown',
    // El contenido inicial no cuenta como cambio: sin esto, abrir para editar
    // ya marcaría el formulario como modificado.
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getMarkdown()),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: cn(
          MARKDOWN_PROSE,
          'min-h-48 px-3 py-2 outline-none md:min-h-64',
          // El placeholder de Tiptap es un atributo: lo pinta el CSS.
          '[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [editor, placeholder]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-sm border border-input shadow-xs transition-[color,box-shadow] dark:bg-input/30',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        invalid && 'border-destructive',
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation();

  // Re-render sólo cuando cambia el estado de la barra, no en cada tecla.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      link: current.isActive('link'),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label={t('markdownEditor.toolbar')}
      className="flex flex-wrap items-center gap-0.5 border-b border-border p-1"
    >
      <ToolbarToggle
        label={t('markdownEditor.heading')}
        pressed={state.h2}
        onToggle={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolbarToggle>
      <ToolbarToggle
        label={t('markdownEditor.subheading')}
        pressed={state.h3}
        onToggle={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 />
      </ToolbarToggle>
      <ToolbarToggle
        label={t('markdownEditor.bold')}
        pressed={state.bold}
        onToggle={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarToggle>
      <ToolbarToggle
        label={t('markdownEditor.italic')}
        pressed={state.italic}
        onToggle={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarToggle>
      <ToolbarToggle
        label={t('markdownEditor.bulletList')}
        pressed={state.bulletList}
        onToggle={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarToggle>
      <ToolbarToggle
        label={t('markdownEditor.orderedList')}
        pressed={state.orderedList}
        onToggle={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarToggle>
      <LinkButton editor={editor} active={state.link} />
    </div>
  );
}

function ToolbarToggle({
  label,
  pressed,
  onToggle,
  children,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Toggle
      size="sm"
      aria-label={label}
      title={label}
      pressed={pressed}
      onPressedChange={onToggle}
      // Sin esto el botón se lleva el foco: en iOS se cierra el teclado y
      // en cualquier browser se pierde la selección sobre la que se aplica.
      onMouseDown={(event) => event.preventDefault()}
      className="rounded-xs"
    >
      {children}
    </Toggle>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');

  const apply = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url) chain.setLink({ href: url }).run();
    else chain.unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setHref((editor.getAttributes('link').href as string | undefined) ?? '');
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Toggle
          size="sm"
          aria-label={t('markdownEditor.link')}
          title={t('markdownEditor.link')}
          pressed={active}
          onMouseDown={(event) => event.preventDefault()}
          className="rounded-xs"
        >
          <Link2 />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2">
        <Input
          type="url"
          inputMode="url"
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder={t('markdownEditor.linkPlaceholder')}
          aria-label={t('markdownEditor.linkUrl')}
          onKeyDown={(event) => {
            // Enter adentro del popover no tiene que mandar el formulario de atrás.
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setHref('');
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                setOpen(false);
              }}
            >
              {t('markdownEditor.removeLink')}
            </Button>
          )}
          <Button type="button" size="sm" onClick={apply}>
            {t('markdownEditor.applyLink')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MarkdownEditor;
