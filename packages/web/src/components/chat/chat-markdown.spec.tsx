import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOSTILE_REPLY, TABLE_REPLY } from '@/lib/chat/mock-assistant';
import { CHAT_LIMITS } from '@/lib/chat/limits';
import { ChatMarkdown } from './chat-markdown';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Un único origen autorizado, sólo para este archivo.
vi.mock('@/lib/chat/limits', async (original) => ({
  ...(await original<typeof import('@/lib/chat/limits')>()),
  ALLOWED_REMOTE_IMAGE_ORIGINS: ['https://cdn.example.com'],
}));

declare global {
  interface Window {
    __pwned?: boolean;
  }
}

const MAX = CHAT_LIMITS.maxAssistantChars;

function renderMd(text: string) {
  return render(<ChatMarkdown text={text} maxChars={MAX} />);
}

/** Lo que nunca puede haber en el DOM, sea cual sea el texto de entrada. */
function expectNoActiveContent(root: HTMLElement) {
  expect(root.querySelector('script, iframe, object, embed, form, style, svg:not([class*="lucide"]), input, link')).toBeNull();
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const attrs = Array.from(el.attributes).map((a) => a.name);
    expect(attrs.filter((a) => a.startsWith('on'))).toEqual([]);
    expect(attrs).not.toContain('style');
  }
  for (const a of Array.from(root.querySelectorAll('a'))) {
    expect(a.getAttribute('href')).toMatch(/^https:\/\//);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('rel')).toContain('noreferrer');
  }
  // Ninguna imagen sale a un origen que no esté autorizado.
  for (const img of Array.from(root.querySelectorAll('img'))) {
    expect(img.getAttribute('src')).toMatch(/^https:\/\/cdn\.example\.com\//);
  }
}

afterEach(() => {
  delete window.__pwned;
});

describe('ChatMarkdown — XSS', () => {
  it('<script> y onerror/onload no ejecutan código ni crean elementos', () => {
    const { container } = renderMd(
      [
        '<script>window.__pwned = true</script>',
        '<img src="x" onerror="window.__pwned = true">',
        '<svg onload="window.__pwned = true"></svg>',
        '<body onload="window.__pwned = true">',
        '<iframe src="https://evil.example.net"></iframe>',
        '<form action="https://evil.example.net"><input name="pw"></form>',
        '<div style="position:fixed;inset:0">tapa</div>',
      ].join('\n\n'),
    );
    expect(window.__pwned).toBeUndefined();
    expectNoActiveContent(container);
    expect(container.querySelector('div[style]')).toBeNull();
  });

  it('el HTML escrito se ve como texto, no como etiquetas', () => {
    renderMd('<img src="x" onerror="alert(1)">');
    expect(screen.getByTestId('chat-markdown').textContent).toContain('onerror="alert(1)"');
  });

  it('HTML y JavaScript dentro de bloques de código se muestran literalmente', () => {
    const { container } = renderMd(
      ['```html', '<script>alert("xss")</script>', '<img src="x" onerror="alert(1)">', '```', '', '`<b onclick="x()">`'].join('\n'),
    );
    const pre = container.querySelector('pre code');
    expect(pre?.textContent).toContain('<script>alert("xss")</script>');
    expect(pre?.textContent).toContain('<img src="x" onerror="alert(1)">');
    expect(container.querySelector('pre code script, pre code img')).toBeNull();
    expect(container.querySelector(':not(pre) > code')?.textContent).toBe('<b onclick="x()">');
    // La clase `language-html` viene del texto: no se reenvía.
    expect(container.querySelector('code')?.getAttribute('class')).toBeNull();
    expectNoActiveContent(container);
  });

  it('los bloques de JavaScript tampoco se ejecutan', () => {
    const { container } = renderMd('```js\nwindow.__pwned = true;\n```');
    expect(window.__pwned).toBeUndefined();
    expect(container.querySelector('code')?.textContent).toContain('window.__pwned = true;');
  });
});

describe('ChatMarkdown — enlaces', () => {
  it.each([
    ['javascript', '[x](javascript:alert(1))'],
    ['vbscript', '[x](vbscript:msgbox(1))'],
    ['file', '[x](file:///etc/passwd)'],
    ['data', '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
    ['mayúsculas', '[x](JAVASCRIPT:alert(1))'],
    ['http', '[x](http://react.dev)'],
    ['referencia', '[x][r]\n\n[r]: javascript:alert(1)'],
    ['autolink', '<javascript:alert(1)>'],
  ])('bloquea %s', (_name, md) => {
    const { container } = renderMd(md);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getAllByTestId('blocked-link').length).toBeGreaterThan(0);
    expectNoActiveContent(container);
  });

  it('un enlace https válido funciona y se abre con noopener noreferrer', () => {
    renderMd('[React](https://react.dev/learn)');
    const link = screen.getByRole('link', { name: 'React' });
    expect(link).toHaveAttribute('href', 'https://react.dev/learn');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('ChatMarkdown — imágenes', () => {
  it('bloquea imágenes de orígenes no autorizados y data: sin pedirlas', () => {
    const { container } = renderMd(
      '![a](https://tracker.example.net/p.png)\n\n![b](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)\n\n![c](javascript:alert(1))',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByTestId('blocked-image')).toHaveLength(3);
  });

  it('muestra una imagen de un origen HTTPS autorizado', () => {
    const { container } = renderMd('![Plano](https://cdn.example.com/plano.png)');
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/plano.png');
    expect(img).toHaveAttribute('alt', 'Plano');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('un blob: escrito por el asistente no se carga', () => {
    const { container } = renderMd('![x](blob:https://luma.test/forjada)');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('blocked-image')).toBeInTheDocument();
  });
});

describe('ChatMarkdown — mismas reglas durante el streaming', () => {
  it('cada prefijo parcial del contenido hostil es seguro', () => {
    for (let end = 1; end <= HOSTILE_REPLY.length; end += 3) {
      const { container, unmount } = renderMd(HOSTILE_REPLY.slice(0, end));
      expectNoActiveContent(container);
      unmount();
    }
    expect(window.__pwned).toBeUndefined();
  });

  it('un enlace o una imagen cortados a la mitad no generan nada activo', () => {
    for (const partial of ['[x](javascript:ale', '![x](https://tracker.example.net/p', '<scr', '<img src=x onerr', '```html\n<script>']) {
      const { container, unmount } = renderMd(partial);
      expectNoActiveContent(container);
      unmount();
    }
  });
});

describe('ChatMarkdown — Markdown válido', () => {
  it('renderiza formato, listas, tablas y enlaces', () => {
    const { container } = renderMd(TABLE_REPLY);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: 'Presupuestado' })).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('Avance:');
    expect(container.querySelector('em')?.textContent).toBe('Próximo hito:');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'la guía' })).toHaveAttribute('href', 'https://react.dev/learn');
    // `align` de la tabla se convertiría en `style`: no pasa.
    expectNoActiveContent(container);
  });

  it('renderiza citas, código en línea y listas ordenadas', () => {
    const { container } = renderMd('> cita\n\n1. uno\n2. dos\n\nusa `pnpm test`');
    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(container.querySelector('code')?.textContent).toBe('pnpm test');
  });
});

describe('ChatMarkdown — límites', () => {
  it('un contenido demasiado complejo se muestra como texto plano', () => {
    const rows = Array.from({ length: CHAT_LIMITS.maxTableRows + 5 }, (_, i) => `| ${i} | x |`).join('\n');
    const { container } = renderMd(`| a | b |\n| - | - |\n${rows}`);
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('secureChat.plainMode')).toBeInTheDocument();
  });

  it('demasiadas imágenes pasan a texto plano sin pedir ninguna', () => {
    const imgs = Array.from({ length: CHAT_LIMITS.maxImagesPerMessage + 1 }, () => '![x](https://cdn.example.com/a.png)').join('\n\n');
    const { container } = renderMd(imgs);
    expect(container.querySelector('img')).toBeNull();
  });

  it('un texto enorme se recorta', () => {
    const { container } = render(<ChatMarkdown text={'a'.repeat(500)} maxChars={100} />);
    expect(container.textContent).toContain('a'.repeat(100));
    expect(container.textContent).not.toContain('a'.repeat(101));
    expect(screen.getByText('secureChat.truncated')).toBeInTheDocument();
  });

  it('un valor que no es texto produce un estado vacío seguro', () => {
    const { container } = render(<ChatMarkdown text={{ evil: true }} maxChars={MAX} />);
    expect(container.querySelector('a, img, script')).toBeNull();
  });
});
